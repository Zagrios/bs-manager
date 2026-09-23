import path from 'path';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync } from 'fs-extra';
import { execFileSync } from 'child_process';

const root = path.join(__dirname, '..', '..');
const externalsFolder = path.join(root, 'externals');
const scriptsFolder = path.join(root, 'assets', 'scripts');
const linuxTargets = { x64: 'x86_64-unknown-linux-musl', arm64: 'aarch64-unknown-linux-musl' };
const downloaderTarget = process.env.BS_DOWNLOADER_TARGET || (process.platform === 'linux' ? linuxTargets[process.arch] : undefined);

if (!['win32', 'linux'].includes(process.platform) || (process.platform === 'linux' && !downloaderTarget)) {
    throw new Error(`Unsupported Rust build platform: ${process.platform}/${process.arch}`);
}

const rustProjects = readdirSync(externalsFolder).filter(folder =>
    existsSync(path.join(externalsFolder, folder, 'Cargo.toml')) &&
    (process.platform === 'win32' || folder === 'bs-downloader')
);

mkdirSync(scriptsFolder, { recursive: true });
rustProjects.forEach(project => {
    const cwd = path.join(externalsFolder, project);
    const target = project === 'bs-downloader' ? downloaderTarget : undefined;
    const args = ['build', '--release', '--locked'];
    if (target) { args.push('--target', target); }
    const env = { ...process.env };
    if (process.platform === 'linux' && target === linuxTargets[process.arch]) {
        const targetKey = target.replaceAll('-', '_');
        env[`CC_${targetKey}`] ||= 'musl-gcc';
        env[`CARGO_TARGET_${targetKey.toUpperCase()}_LINKER`] ||= 'musl-gcc';
    }
    console.log(`Building ${project}`);
    execFileSync('cargo', args, { cwd, stdio: 'inherit', env });

    const projectMetadata = execFileSync('cargo', ['metadata', '--no-deps', '--format-version', '1'], {
        cwd,
        stdio: 'pipe',
    });
    const projectMetadataJson = JSON.parse(projectMetadata);
    const projectName = projectMetadataJson.packages[0].name;

    const filename = process.platform === 'win32' ? `${projectName}.exe` : projectName;
    const source = path.join(cwd, 'target', ...(target ? [target] : []), 'release', filename);
    const destination = path.join(scriptsFolder, filename);
    console.log(`Copying ${source} to ${destination}`);
    copyFileSync(source, destination);
    if (process.platform === 'linux') { chmodSync(destination, 0o755); }
});
