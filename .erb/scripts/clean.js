import { rimrafSync } from 'rimraf';
import fs from 'fs';
import paths from '../configs/paths';

const foldersToRemove = [
  paths.distPath,
  paths.buildPath,
];

foldersToRemove.forEach((folder) => {
  if (fs.existsSync(folder)) rimrafSync(folder);
});
