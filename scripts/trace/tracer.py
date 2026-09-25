# gdb Python script: runs a program line by line and records, at every line,
# the call stack with each variable's value, the live heap blocks, and the
# output so far. scripts/build-visuals.mjs runs it as:
#
#   gdb -q -batch -nx -x tracer.py
#
# with TRACE_EXE, TRACE_SRC (source file name), TRACE_IN (stdin file),
# TRACE_OUT (program output file) and TRACE_JSON (where to write the trace).
import gdb
import json
import os

EXE = os.environ["TRACE_EXE"]
SRC = os.environ["TRACE_SRC"]
STDIN = os.environ["TRACE_IN"]
PROG_OUT = os.environ["TRACE_OUT"]
JSON_OUT = os.environ["TRACE_JSON"]
MAX_STEPS = int(os.environ.get("TRACE_MAX", "400"))
MAX_ITEMS = 24

gdb.execute("set pagination off")
gdb.execute("set confirm off")
gdb.execute("set width 0")
gdb.execute("set print elements 40")
gdb.execute("set startup-with-shell on")
gdb.execute("file " + EXE)
gdb.execute("break main", to_string=True)
gdb.execute("run < %s > %s 2>&1" % (STDIN, PROG_OUT), to_string=True)

C = gdb


def is_user(frame):
    try:
        sal = frame.find_sal()
    except Exception:
        return False
    return bool(sal and sal.symtab and os.path.basename(sal.symtab.filename) == SRC)


def type_name(t):
    s = str(t)
    return s.replace("std::__cxx11::", "std::")


class Snapshot:
    """Serializes values for one step, giving every addressable piece an id."""

    def __init__(self):
        self.next_id = 0
        self.by_addr = {}  # address -> list of (id, type code, depth, label)
        self.pointers = []  # (node, target address, target type)
        self.freed = []  # (address, size) of heap blocks that were freed
        self.owned = []  # heap buffers owned by library objects: (address, element type, count, description)

    def new_id(self):
        self.next_id += 1
        return "n%d" % self.next_id

    def note(self, node, addr, t, depth, label):
        if addr is None:
            return
        self.by_addr.setdefault(addr, []).append((node["id"], t.strip_typedefs().code, depth, label))

    def value(self, val, label, depth=0):
        node = {"id": self.new_id()}
        t = val.type
        st = t.strip_typedefs()
        node["t"] = type_name(t)
        addr = None
        try:
            if val.address is not None:
                addr = int(val.address)
        except Exception:
            addr = None
        code = st.code
        try:
            if code == C.TYPE_CODE_PTR:
                target = st.target().strip_typedefs()
                p = int(val)
                node["k"] = "ptr"
                node["v"] = "NULL" if p == 0 else hex(p)
                if target.code == C.TYPE_CODE_FUNC:
                    node["k"] = "text"
                    node["v"] = str(val).split(" <")[-1].rstrip(">") if "<" in str(val) else hex(p)
                elif p != 0:
                    if target.code == C.TYPE_CODE_INT and target.sizeof == 1:
                        try:
                            node["s"] = val.string(length=60)
                        except Exception:
                            pass
                    self.pointers.append((node, p, st.target()))
            elif code == C.TYPE_CODE_REF or code == C.TYPE_CODE_RVALUE_REF:
                ref = val.referenced_value()
                node["k"] = "ref"
                node["v"] = "ref"
                try:
                    p = int(ref.address)
                    self.pointers.append((node, p, ref.type))
                except Exception:
                    node["k"] = "text"
                    node["v"] = str(ref)
            elif code == C.TYPE_CODE_ARRAY:
                lo, hi = st.range()
                n = hi - lo + 1
                node["k"] = "arr"
                items = []
                for i in range(min(n, MAX_ITEMS)):
                    items.append(self.value(val[lo + i], "%s[%d]" % (label, i), depth + 1))
                node["items"] = items
                if n > MAX_ITEMS:
                    node["more"] = n - MAX_ITEMS
                el = st.target().strip_typedefs()
                if el.code == C.TYPE_CODE_INT and el.sizeof == 1:
                    try:
                        node["s"] = val.string(length=n)
                    except Exception:
                        pass
            elif code == C.TYPE_CODE_STRUCT and (st.tag or "").startswith(("std::unique_ptr<", "std::shared_ptr<")):
                # Show smart pointers as arrows to what they own.
                target = st.template_argument(0)
                text = val.format_string()
                import re
                m = re.search(r"0x[0-9a-f]+", text)
                p = int(m.group(0), 16) if m else 0
                node["k"] = "ptr"
                node["v"] = "nullptr" if p == 0 else hex(p)
                node["smart"] = "unique_ptr" if st.tag.startswith("std::unique_ptr") else "shared_ptr"
                if "use count" in text:
                    m2 = re.search(r"use count (\d+)", text)
                    if m2:
                        node["uses"] = int(m2.group(1))
                if p:
                    self.pointers.append((node, p, target))
            elif code == C.TYPE_CODE_STRUCT and (st.tag or "").startswith("std::vector<"):
                node["k"] = "text"
                node["v"] = val.format_string(max_elements=20)
                try:
                    impl = val["_M_impl"]
                    start = int(impl["_M_start"])
                    size = int(impl["_M_finish"] - impl["_M_start"])
                    cap = int(impl["_M_end_of_storage"] - impl["_M_start"])
                    if start:
                        self.owned.append((start, st.template_argument(0), size, "buffer of %s (size %d, capacity %d)" % (label, size, cap)))
                        self.pointers.append((node, start, st.template_argument(0)))
                except Exception:
                    pass
            elif code in (C.TYPE_CODE_STRUCT, C.TYPE_CODE_UNION):
                pretty = gdb.default_visualizer(val)
                if pretty is not None or st.tag is None or (st.tag or "").startswith("std::"):
                    node["k"] = "text"
                    node["v"] = val.format_string(pretty_structs=False, max_elements=20, repeat_threshold=100)
                else:
                    node["k"] = "struct"
                    fields = []
                    for f in st.fields():
                        if getattr(f, "artificial", False) or not hasattr(f, "bitpos"):
                            continue
                        name = f.name or ("(base %s)" % type_name(f.type)) if f.is_base_class else f.name
                        if name is None:
                            continue
                        if name.startswith("_vptr"):
                            continue
                        child = self.value(val[f], "%s.%s" % (label, f.name) if not f.is_base_class else label, depth + 1)
                        fields.append({"name": name, "v": child})
                    node["fields"] = fields
            elif code == C.TYPE_CODE_BOOL:
                node["k"] = "val"
                node["v"] = "true" if bool(val) else "false"
            elif code == C.TYPE_CODE_INT and st.sizeof == 1:
                node["k"] = "val"
                n = int(val)
                if 32 <= n < 127:
                    node["v"] = "'%s'" % ("\\'" if chr(n) == "'" else "\\\\" if chr(n) == "\\" else chr(n))
                elif n == 0:
                    node["v"] = "'\\0'"
                elif n == 10:
                    node["v"] = "'\\n'"
                else:
                    node["v"] = str(n)
            elif code == C.TYPE_CODE_FLT:
                node["k"] = "val"
                f = float(val)
                node["v"] = ("%.6g" % f) if f == f else "nan"
            else:
                node["k"] = "val"
                node["v"] = val.format_string(raw=False)
        except gdb.MemoryError:
            node["k"] = "val"
            node["v"] = "(unreadable)"
        except Exception as e:  # keep tracing whatever happens
            node["k"] = "val"
            node["v"] = "?"
        self.note(node, addr, t, depth, label)
        return node

    def resolve(self):
        """Point each pointer at the node for the address it holds."""
        for node, p, target in self.pointers:
            cands = self.by_addr.get(p)
            if not cands:
                if any(a <= p < a + max(n, 1) for (a, n) in self.freed):
                    node["dangling"] = True
                continue
            tcode = target.strip_typedefs().code
            same = [c for c in cands if c[1] == tcode]
            pick = max(same, key=lambda c: c[2]) if same and tcode not in (C.TYPE_CODE_STRUCT, C.TYPE_CODE_ARRAY) else (min(same, key=lambda c: c[2]) if same else min(cands, key=lambda c: c[2]))
            node["to"] = pick[0]
            node["tl"] = pick[3]


def frame_vars(frame, snap, visits, top=True):
    try:
        block = frame.block()
    except RuntimeError:
        return []
    line = frame.find_sal().line
    key = (frame.name(), str(frame.read_register("rbp")))
    # A variable declared on this line already exists if we came back up to it
    # from further down (the header of a loop), not when arriving from above.
    prev = visits.get(key)
    seen_line = prev is not None and prev > line
    out = []
    names = set()
    blocks = []
    while block is not None:
        blocks.append(block)
        if block.function is not None:
            break
        block = block.superblock
    for b in reversed(blocks):
        for sym in b:
            if not (sym.is_variable or sym.is_argument) or sym.name in names or sym.name.startswith("__"):
                continue
            building = False
            if sym.is_variable and not sym.is_argument:
                if sym.line > line:
                    continue
                if sym.line == line and not seen_line:
                    is_obj = sym.type.strip_typedefs().code == C.TYPE_CODE_STRUCT
                    # Back on this line after its constructor ran: the object exists now.
                    if top and is_obj and prev == line:
                        pass
                    # Not assigned yet, except an object whose constructor is running right now.
                    elif top or not is_obj:
                        continue
                    else:
                        building = True
                if sym.addr_class == gdb.SYMBOL_LOC_STATIC:
                    continue
            try:
                val = sym.value(frame)
            except Exception:
                continue
            names.add(sym.name)
            node = snap.value(val, sym.name)
            if sym.is_variable and not sym.is_argument and building:
                node = {"id": node["id"], "t": node["t"], "k": "text", "v": "(being built by its constructor)"}
            out.append({"name": sym.name, "arg": bool(sym.is_argument), "v": node})
    if top:
        visits[key] = line
    return out


def heap(snap):
    blocks = []
    try:
        n = int(gdb.parse_and_eval("arena_nblocks"))
    except Exception:
        return blocks
    live = []
    seq = {}
    for i in range(n):
        b = gdb.parse_and_eval("arena_blocks[%d]" % i)
        if int(b["live"]):
            live.append((int(b["p"]), int(b["n"])))
            seq[int(b["p"])] = i + 1
        else:
            snap.freed.append((int(b["p"]), int(b["n"])))
    typed = {}
    for (addr, el, count, desc) in snap.owned:
        if addr in seq and count > 0:
            try:
                v = gdb.parse_and_eval("*(%s *)%d@%d" % (el, addr, min(count, MAX_ITEMS)))
                typed[addr] = {"addr": hex(addr), "size": dict(live)[addr], "label": "heap block %d" % seq[addr], "note": desc, "v": snap.value(v, "heap block %d" % seq[addr])}
            except Exception:
                pass
    # Give each block the type of the pointers that point at it (the most
    # specific one, so a Shape* to a Square shows a Square), then look inside
    # those blocks for more pointers (linked lists, trees) a few times over.
    sizes = dict(live)
    done = set()
    for _ in range(6):
        best = {}
        for node, p, target in list(snap.pointers):
            if p not in sizes or p in typed or p in done:
                continue
            t = target
            st = t.strip_typedefs()
            if st.code == C.TYPE_CODE_VOID or st.sizeof == 0:
                continue
            if st.code == C.TYPE_CODE_STRUCT:
                try:
                    dt = gdb.parse_and_eval("*(%s *)%d" % (t, p)).dynamic_type
                    if dt.sizeof > st.sizeof:
                        t = dt
                except Exception:
                    pass
            if p not in best or t.strip_typedefs().sizeof > best[p].strip_typedefs().sizeof:
                best[p] = t
        if not best:
            break
        for addr, t in best.items():
            done.add(addr)
            st = t.strip_typedefs()
            size = sizes[addr]
            count = max(1, size // st.sizeof)
            if st.code == C.TYPE_CODE_STRUCT and size < 2 * st.sizeof:
                count = 1
            label = "heap block %d" % seq[addr]
            try:
                if count == 1:
                    v = gdb.parse_and_eval("*(%s *)%d" % (t, addr))
                else:
                    v = gdb.parse_and_eval("*(%s *)%d@%d" % (t, addr, min(count, MAX_ITEMS)))
            except Exception:
                continue
            typed[addr] = {"addr": hex(addr), "size": size, "label": label, "v": snap.value(v, label)}
    # Pointers into the middle of a block (make_shared puts the object after its
    # reference counts): show the object they point at inside that block.
    for node, p, target in list(snap.pointers):
        for (addr, size) in live:
            if addr < p < addr + size and addr not in typed:
                st = target.strip_typedefs()
                if st.code == C.TYPE_CODE_VOID or st.sizeof == 0 or p + st.sizeof > addr + size:
                    continue
                label = "heap block %d" % seq[addr]
                try:
                    v = gdb.parse_and_eval("*(%s *)%d" % (target, p))
                except Exception:
                    continue
                typed[addr] = {"addr": hex(addr), "size": size, "label": label, "note": "%d bytes of bookkeeping (such as reference counts), then the object" % (p - addr), "v": snap.value(v, label)}
    for (addr, size) in live:
        blocks.append(typed.get(addr) or {"addr": hex(addr), "size": size, "label": "heap block %d" % seq[addr], "v": None})
    return blocks


def read_output():
    try:
        with open(PROG_OUT, "r", errors="replace") as f:
            return f.read()[:4000]
    except Exception:
        return ""


steps = []
visits = {}
last_here = None
truncated = False
while True:
    try:
        frame = gdb.selected_frame()
    except gdb.error:
        break
    if not gdb.selected_inferior().pid:
        break
    if not is_user(frame):
        try:
            gdb.execute("finish", to_string=True)
        except gdb.error:
            try:
                gdb.execute("step", to_string=True)
            except gdb.error:
                break
        continue
    # A call into a library function (printf, malloc) comes back to the same
    # line; that isn't a new step for the learner.
    here = (frame.name(), frame.find_sal().line, str(frame.read_register("rbp")))
    if steps and here == last_here:
        try:
            gdb.execute("step", to_string=True)
        except gdb.error:
            break
        continue
    last_here = here
    if len(steps) >= MAX_STEPS:
        truncated = True
        break
    snap = Snapshot()
    frames = []
    f = frame
    while f is not None:
        if is_user(f):
            fr = {"fn": f.name(), "line": f.find_sal().line, "vars": frame_vars(f, snap, visits if f == frame else {}, f == frame)}
            # A deleting destructor calls the plain one on the same line: show it once.
            if not (frames and frames[-1]["fn"] == fr["fn"] and frames[-1]["line"] == fr["line"]):
                frames.append(fr)
        if f.name() == "main":
            break
        f = f.older()
    h = heap(snap)
    snap.resolve()
    steps.append({"line": frame.find_sal().line, "frames": frames, "heap": h, "out": read_output()})
    try:
        gdb.execute("step", to_string=True)
    except gdb.error:
        break

final_out = read_output()
with open(JSON_OUT, "w") as f:
    json.dump({"steps": steps, "truncated": truncated, "out": final_out}, f)
gdb.execute("kill", to_string=True) if gdb.selected_inferior().pid else None
