// Turns Clang diagnostics into beginner-friendly explanations.

export type Diagnostic = {
  line: number;
  col: number;
  severity: "error" | "warning" | "note";
  message: string;
  friendly?: string;
  inTests?: boolean;
};

type Rule = { re: RegExp; say: (m: RegExpMatchArray) => string };

const RULES: Rule[] = [
  { re: /expected ';'/, say: () => "A statement is missing its semicolon. Look at the end of this line, or the line just before it." },
  { re: /expected '\}'/, say: () => "A `{` was never closed. Count your braces: every `{` needs a matching `}`." },
  { re: /expected '\)'/, say: () => "A `(` was never closed. Check that your parentheses pair up." },
  { re: /extraneous closing brace|expected external declaration/, say: () => "There is an extra `}` or code sitting outside any function." },
  { re: /use of undeclared identifier '(.+?)'/, say: (m) => `\`${m[1]}\` hasn't been declared. Check the spelling (C/C++ is case-sensitive), declare it before use, or include the header that defines it.` },
  { re: /call to undeclared (?:library )?function '(.+?)'/, say: (m) => `The compiler doesn't know \`${m[1]}\` yet. Include the right header (for example \`#include <stdio.h>\` for printf) or declare the function above where you call it.` },
  { re: /implicit declaration of function '(.+?)'/, say: (m) => `\`${m[1]}\` is used before it's declared. Add the header or a prototype above this line.` },
  { re: /unknown type name '(.+?)'/, say: (m) => `\`${m[1]}\` isn't a type the compiler knows. Is it misspelled, or missing an #include / struct keyword?` },
  { re: /no member named '(.+?)' in '(.+?)'/, say: (m) => `\`${m[2]}\` has no member called \`${m[1]}\`. Check the spelling or the type.` },
  { re: /no matching function for call to '(.+?)'/, say: (m) => `No version of \`${m[1]}\` accepts the arguments you passed. Compare the argument count and types with the declaration.` },
  { re: /no matching (?:member function|constructor) for/, say: () => "None of the available constructors or member functions accept these arguments. Check the argument count and types." },
  { re: /too (few|many) arguments to function call/, say: (m) => `You passed too ${m[1]} arguments. Match the function's parameter list.` },
  { re: /redefinition of '(.+?)'/, say: (m) => `\`${m[1]}\` is defined twice. Rename one or remove the duplicate.` },
  { re: /redefinition of 'main'|conflicting types for 'main'/, say: () => "There are two main() functions. On test-driven steps the hidden tests supply main(), so remove yours." },
  { re: /invalid operands to binary expression \('(.+?)' and '(.+?)'\)/, say: (m) => `You can't use this operator between \`${m[1]}\` and \`${m[2]}\`. Check the types on both sides.` },
  { re: /cannot initialize a variable of type '(.+?)' with an (?:l|r)value of type '(.+?)'/, say: (m) => `You're storing a \`${m[2]}\` into a \`${m[1]}\`. The types don't match.` },
  { re: /incompatible (?:pointer|integer)(?: to (?:pointer|integer))? conversion/, say: () => "Mixing up pointers and plain values. Did you forget `&` (address of) or `*` (dereference)?" },
  { re: /indirection requires pointer operand/, say: () => "You used `*` on something that isn't a pointer." },
  { re: /member reference type '(.+?)' is a pointer; did you mean to use '->'/, say: () => "This is a pointer. Use `->` instead of `.` to reach a member through a pointer." },
  { re: /member reference type '(.+?)' is not a pointer/, say: () => "This isn't a pointer. Use `.` instead of `->`." },
  { re: /cannot assign to variable '(.+?)' with const-qualified type/, say: (m) => `\`${m[1]}\` is const, so it can't be changed after it's set.` },
  { re: /read-only variable is not assignable|cannot assign to .*const/, say: () => "You're trying to modify something const." },
  { re: /non-void function does not return a value/, say: () => "This function promises to return a value but some path reaches the end without `return`." },
  { re: /control reaches end of non-void function|non-void function does not return a value in all control paths/, say: () => "Some path through the function ends without a `return`." },
  { re: /format specifies type '(.+?)' but the argument has type '(.+?)'/, say: (m) => `The printf/scanf format expects \`${m[1]}\` but you passed \`${m[2]}\`. Use %d for int, %f for double, %c for char, %s for strings, %p for pointers.` },
  { re: /more '%' conversions than data arguments/, say: () => "The format string has more `%` placeholders than values after it." },
  { re: /data argument not used by format string/, say: () => "You passed more values than the format string has `%` placeholders." },
  { re: /using the result of an assignment as a condition/, say: () => "`=` assigns; `==` compares. You probably meant `==` here." },
  { re: /unused variable '(.+?)'/, say: (m) => `\`${m[1]}\` is declared but never used. Not an error, just a hint you may have forgotten something.` },
  { re: /variable '(.+?)' is uninitialized when used/, say: (m) => `\`${m[1]}\` is read before it gets a value. Give it a starting value.` },
  { re: /comparison of integers of different signs/, say: () => "Comparing signed and unsigned numbers can surprise you. A common fix is `size_t i` for loop counters over `.size()`." },
  { re: /array index (\-?\d+) is past the end of the array/, say: (m) => `Index ${m[1]} is outside the array. Valid indexes run from 0 to size-1.` },
  { re: /undefined symbol: main|undefined reference to `main'/, say: () => "There's no `int main()` function. Every program needs one to start." },
  { re: /undefined symbol: (.+)/, say: (m) => `\`${m[1].trim()}\` was declared but never defined (no function body). Did you write the body?` },
  { re: /missing terminating '"' character/, say: () => "A string is missing its closing `\"` quote." },
  { re: /missing terminating ' character/, say: () => "A character literal is missing its closing `'` quote. Strings use double quotes." },
  { re: /'(.+?)' file not found/, say: (m) => `There's no header called \`${m[1]}\`. Check the spelling (for example \`<stdio.h>\`, \`<iostream>\`).` },
  { re: /expected expression/, say: () => "The compiler expected a value here. Look for a stray symbol, an extra comma, or a missing operand." },
  { re: /expected unqualified-id/, say: () => "Something unexpected appears where a name was expected. Often a stray `;`, `}` or a keyword used as a name." },
  { re: /allocating an object of abstract class type/, say: () => "This class has a pure virtual function, so you can't create one directly. Create a derived class that overrides it." },
  { re: /call to deleted (?:constructor|function)|copy constructor .* is implicitly deleted/, say: () => "This object can't be copied (unique_ptr is a common example). Move it with std::move or pass a reference." },
  { re: /'(.+?)' is a private member of/, say: (m) => `\`${m[1]}\` is private. Only the class's own member functions can touch it.` },
  { re: /no viable overloaded '(.+?)'/, say: (m) => `No \`${m[1]}\` operator works for these types. You may need to define it.` },
  { re: /no viable conversion from '(.+?)' to '(.+?)'/, say: (m) => `A \`${m[1]}\` can't be turned into a \`${m[2]}\`.` },
  { re: /subscripted value is not an array, pointer, or vector/, say: () => "You used `[ ]` on something that isn't an array, pointer or container." },
  { re: /declaration shadows a local variable/, say: () => "A new variable hides an existing one with the same name." },
  { re: /expression is not assignable/, say: () => "The left side of `=` must be a variable you can store into." },
];

export function explain(message: string): string | undefined {
  for (const r of RULES) {
    const m = message.match(r.re);
    if (m) return r.say(m);
  }
  return undefined;
}

/** Parse clang output such as `main.c:3:5: error: message`. */
export function parseDiagnostics(raw: string, userLines: number): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const line of raw.split("\n")) {
    const m = line.match(/^(?:.*?)main\.(?:c|cpp):(\d+):(\d+): (error|warning|note|fatal error): (.*)$/);
    if (m) {
      const ln = +m[1];
      const severity = m[3] === "fatal error" ? "error" : (m[3] as Diagnostic["severity"]);
      out.push({ line: ln, col: +m[2], severity, message: m[4], friendly: explain(m[4]), inTests: ln > userLines });
      continue;
    }
    const l = line.match(/wasm-ld: error: .*?(undefined symbol: .*)$/);
    if (l) out.push({ line: 0, col: 0, severity: "error", message: l[1], friendly: explain(l[1]) });
  }
  return out;
}
