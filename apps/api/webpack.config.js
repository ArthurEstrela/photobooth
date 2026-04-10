const path = require('path');

module.exports = (options) => ({
  ...options,
  resolve: {
    ...options.resolve,
    alias: {
      '@packages/shared': path.resolve(__dirname, '../../packages/shared/src/types.ts'),
    },
  },
});
