import fs from 'fs';
import paths from '../configs/paths';

const { srcNodeModulesPath, appNodeModulesPath, erbNodeModulesPath } = paths;

if (!fs.existsSync(srcNodeModulesPath) && fs.existsSync(appNodeModulesPath)) {
  fs.symlinkSync(appNodeModulesPath, srcNodeModulesPath, 'junction');
}

if (!fs.existsSync(erbNodeModulesPath) && fs.existsSync(appNodeModulesPath)) {
  fs.symlinkSync(appNodeModulesPath, erbNodeModulesPath, 'junction');
}
