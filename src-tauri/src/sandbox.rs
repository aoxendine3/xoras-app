// src-tauri/src/sandbox.rs
//
//! Pure command-allow-list validator used to sandbox shell execution when the app
//! is *not* running in Developer mode.
//!
//! The function is intentionally dependency-free and side-effect-free so it can be
//! unit-tested without a running shell or Tauri app. It is deliberately conservative:
//! it rejects anything that could chain, redirect, or substitute commands, and only
//! permits a small set of read-only / inspection programs.

/// Programs permitted when Developer mode is disabled. Kept conservative on purpose —
/// mostly read-only inspection tools plus the two the app itself talks to (`ollama`, `git`).
const ALLOWED_PROGRAMS: &[&str] = &[
    "ls", "pwd", "echo", "whoami", "uname", "date", "df", "free", "uptime", "git", "ollama",
];

/// Shell metacharacters that enable chaining, redirection, or substitution. Because the
/// command is ultimately handed to a shell, any of these could escape the allow-list.
const FORBIDDEN_CHARS: &[char] = &[';', '|', '&', '<', '>', '`', '$', '(', ')', '{', '}', '\n', '\r'];

/// Validate a command string against the allow-list.
///
/// The Terminal panel prepends `cd <dir> && ` to every command, so a single leading
/// `cd <token> &&` prefix is tolerated (and its `&&` ignored) before the remainder is
/// validated. Everything else containing shell metacharacters is rejected.
pub fn is_allowed(command: &str) -> Result<(), String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return Err("Empty command".to_string());
    }

    // Tolerate exactly one leading `cd <token> &&` prefix (added by the Terminal panel).
    let effective = strip_cd_prefix(trimmed);

    if let Some(bad) = effective.chars().find(|c| FORBIDDEN_CHARS.contains(c)) {
        return Err(format!(
            "Command blocked: contains disallowed character '{bad}'. Enable Developer mode for an unrestricted console."
        ));
    }

    let program = effective.split_whitespace().next().unwrap_or("");
    if program.is_empty() {
        return Err("Empty command".to_string());
    }

    if ALLOWED_PROGRAMS.contains(&program) {
        Ok(())
    } else {
        Err(format!(
            "Command '{program}' is not on the safe allow-list. Enable Developer mode in Settings for an unrestricted console."
        ))
    }
}

/// If `command` starts with `cd <single-token> &&`, return the remainder; otherwise
/// return the command unchanged.
fn strip_cd_prefix(command: &str) -> &str {
    if let Some((left, right)) = command.split_once("&&") {
        let mut parts = left.split_whitespace();
        if parts.next() == Some("cd") {
            // exactly one path token, nothing else before the &&
            let token = parts.next();
            if token.is_some() && parts.next().is_none() {
                return right.trim();
            }
        }
    }
    command
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_listed_programs() {
        assert!(is_allowed("ls -la").is_ok());
        assert!(is_allowed("git status").is_ok());
        assert!(is_allowed("ollama list").is_ok());
        assert!(is_allowed("pwd").is_ok());
    }

    #[test]
    fn allows_terminal_cd_prefix() {
        assert!(is_allowed("cd /home/user && ls -la").is_ok());
        assert!(is_allowed("cd /tmp && git status").is_ok());
    }

    #[test]
    fn rejects_unlisted_program() {
        assert!(is_allowed("rm -rf /").is_err());
        assert!(is_allowed("curl http://evil.example").is_err());
        assert!(is_allowed("cat /etc/passwd").is_err());
    }

    #[test]
    fn rejects_command_chaining_and_injection() {
        assert!(is_allowed("ls; rm -rf /").is_err());
        assert!(is_allowed("git status && curl evil").is_err());
        assert!(is_allowed("ls | sh").is_err());
        assert!(is_allowed("echo $(rm -rf /)").is_err());
        assert!(is_allowed("ls > /etc/hosts").is_err());
        assert!(is_allowed("echo `whoami`").is_err());
    }

    #[test]
    fn rejects_empty() {
        assert!(is_allowed("").is_err());
        assert!(is_allowed("   ").is_err());
    }

    #[test]
    fn cd_prefix_does_not_whitelist_dangerous_remainder() {
        assert!(is_allowed("cd /tmp && rm -rf /").is_err());
    }
}
