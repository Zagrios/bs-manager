const userAgent = process.env.npm_config_user_agent ?? "";

if (!userAgent.startsWith("pnpm/")) {
    console.error("This project requires pnpm 10.34.4. Run `mise install`, then use `pnpm`.");
    process.exit(1);
}
