import { gray, green, yellow } from "@ryu/enogu";

export function showHelp(): void {
  console.log(
    `A CLI tool to pin dependency versions in JavaScript package managers

${gray("USAGE")}: ${green("pindeps [OPTIONS]")}

${yellow("OPTIONS:")}
  ${green("    --check")}     Check if dependencies are pinned (exit 1 if not)
  ${green("    --dev")}       Pin only devDependencies
  ${green("-h, --help")}      Show this help message
  ${green("    --version")}   Show version number

${yellow("EXAMPLES")}:
  pindeps              Pin all dependencies
  pindeps --dev        Pin only devDependencies
  pindeps --check      Check if all dependencies are pinned

${yellow("SUPPORTED PACKAGE MANAGERS:")}
  npm, Yarn, pnpm, Bun, Deno

${yellow("GitHub")}: https://github.com/ryuapp/pindeps
${yellow("Bugs")}: https://github.com/ryuapp/pindeps/issues`,
  );
}
