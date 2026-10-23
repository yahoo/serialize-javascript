# Security Policy

## Supported Versions

Security fixes are released for the latest major version only.

| Version | Supported |
| ------- | --------- |
| 7.x     | Yes       |
| < 7.0   | No        |

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues, pull requests, or discussions.

Instead, report them privately through GitHub's [private vulnerability reporting](https://github.com/yahoo/serialize-javascript/security/advisories/new). This opens a draft security advisory that only the maintainers can see, where we can discuss the issue with you, develop a fix, and coordinate disclosure.

Please include:

- The affected version(s)
- A minimal reproduction (input, options, and the resulting output)
- The context the output is used in (e.g. embedded in an HTML `<script>` element)
- The impact you believe it has

We will acknowledge your report as soon as we can, keep you updated on progress, and credit you in the published advisory unless you prefer otherwise.

## Scope

`serialize-javascript` escapes its output so it can be safely embedded in an HTML `<script>` element (unless `options.unsafe` is set). Reports that untrusted **data** (strings, object keys, regexps, dates, etc.) can break out of that context are in scope.

Serializing a **function** emits its source text as code. If an attacker can control the source text of a function you serialize, they can already run code in your page, so that is not a vulnerability by itself. We still treat a function body that escapes the `<script>` element (for example, injecting HTML markup) as a defect and fix it, but it is considered low severity.
