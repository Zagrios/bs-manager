import path from 'path';
import { copyFileSync, existsSync, readdirSync } from 'fs-extra';
import { execSync } from 'child_process';

const eternalsFolder = path.join(__dirname, '..', '..', 'externals');

// Get rust project folders from externals
const rustProjects = readdirSync(eternalsFolder).filter(folder => existsSync(path.join(eternalsFolder, folder, 'Cargo.toml')));

// Build each rust project in release mode
rustProjects.forEach(project => {
    console.log(`Building ${project}`);
    execSync(`cargo build --release`, {
        cwd: path.join(eternalsFolder, project),
        stdio: 'inherit',
    });
});

// Copy the built files exe to the assests/scripts folder
rustProjects.forEach(project => {
    // read the project name from Cargo.toml using toml parser
    const projectMetadata = execSync('cargo metadata --no-deps --format-version 1', {
        cwd: path.join(eternalsFolder, project),
        stdio: 'pipe',
    });
    const projectMetadataJson = JSON.parse(projectMetadata);
    const projectName = projectMetadataJson.packages[0].name;

    const source = path.join(eternalsFolder, project, 'target', 'release', `${projectName}.exe`);
    const destination = path.join(__dirname, '..', '..', 'assets', 'scripts', `${projectName}.exe`);
    console.log(`Copying ${source} to ${destination}`);
    copyFileSync(source, destination);
});
