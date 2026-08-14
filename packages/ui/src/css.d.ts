// The package ships TypeScript source and lets each app's bundler compile it.
// Declaring the CSS module here (rather than relying on `vite/client`) keeps
// the package free of any dependency on a particular bundler.
declare module '*.css';
