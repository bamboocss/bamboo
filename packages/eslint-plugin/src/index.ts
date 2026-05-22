import { name, version } from '../package.json';
import all from './configs/all';
import recommended from './configs/recommended';
import { rules } from './rules';

const plugin = {
  configs: {
    all,
    recommended,
  },
  meta: {
    name,
    version,
  },
  rules,
};

module.exports = plugin;
