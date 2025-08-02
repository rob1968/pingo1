const gulp = require('gulp');
const sass = require('gulp-sass')(require('sass')); // Updated sass initialization
const concat = require('gulp-concat');
const { deleteAsync } = require('del'); // Updated import for del v7+
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const rename = require('gulp-rename');
const server = require('gulp-server-livereload');
const sourcemaps = require('gulp-sourcemaps');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const browserify = require('browserify');
const watchify = require('watchify');
const babelify = require('babelify');
const gulpJest = require('gulp-jest').default;


const paths = {
  html: 'index.html',
  scripts: './src/**/*.js',
  sass: './styles/**/*.scss',
  tests: './front-end-tests/__tests__',
  backOfficeScripts: './src/back-office/**/*.js',
  discovererScripts: './src/back-office/*.js',
  backOfficeSass: './styles/sass/back-office/**/*.scss',
  buildSass: './build/styles',
  buildScripts: './build/js',
  backOfficeTests: './back-office-tests/__tests__'
};

const clean = () => deleteAsync(['build', 'coverage']); // Use deleteAsync

// Removed lint task - should be run separately via npm script

const scripts = () => {
  const bundler = watchify(browserify('./src/app.js', { debug: true }).transform(babelify, { presets: ["@babel/preset-env"] }));
  const rebundle = () => {
    return bundler.bundle()
      .on('error', function(err) {
        console.error('[gulpfile] Error in scripts task: ', err.message);
        this.emit('end');
      })
      .pipe(source('app.js'))
      .pipe(buffer())
      .pipe(sourcemaps.init({ loadMaps: true }))
      .pipe(sourcemaps.write('./'))
      .pipe(gulp.dest(paths.buildScripts));
  };
  bundler.on('update', rebundle);
  return rebundle();
};

const scriptsBuild = () => {
  return browserify('./src/app.js', { debug: true })
    .transform(babelify, { presets: ["@babel/preset-env"] })
    .bundle()
    .on('error', function(err) {
      console.error('[gulpfile] Error in scriptsBuild task: ', err.message);
      this.emit('end');
    })
    .pipe(source('app.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest(paths.buildScripts));
};

const scriptsBackOffice = () => {
  const bundler = watchify(browserify('./src/back-office/back-office-app.js', { debug: true })
    .transform(babelify, { presets: ["@babel/preset-env", "@babel/preset-react"] }));
  const rebundle = () => {
    return bundler.bundle()
      .on('error', function(err) {
        console.error('[gulpfile] Error in scriptsBackOffice task', err.message);
        this.emit('end');
      })
      .pipe(source('back-office.js'))
      .pipe(buffer())
      .pipe(sourcemaps.init({ loadMaps: true }))
      .pipe(sourcemaps.write('./'))
      .pipe(gulp.dest(paths.buildScripts));
  };
  bundler.on('update', rebundle);
  return rebundle();
};

const scriptsBackOfficeBuild = () => {
  return browserify('./src/back-office/back-office-app.js', { debug: true })
    .transform(babelify, { presets: ["@babel/preset-env", "@babel/preset-react"] })
    .bundle()
    .on('error', function(err) {
      console.error('[gulpfile] Error in scriptsBackOfficeBuild task', err.message);
      this.emit('end');
    })
    .pipe(source('back-office.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest(paths.buildScripts));
};

const scriptsDiscoverer = () => {
  const bundler = watchify(browserify('./src/back-office/discoverer.js', { debug: true })
    .transform(babelify, { presets: ["@babel/preset-env", "@babel/preset-react"] }));
  const rebundle = () => {
    return bundler.bundle()
      .on('error', function(err) {
        console.error('[gulpfile] Error in scriptsDiscoverer task', err.message);
        this.emit('end');
      })
      .pipe(source('back-office-discoverer.js'))
      .pipe(buffer())
      .pipe(sourcemaps.init({ loadMaps: true }))
      .pipe(sourcemaps.write('./'))
      .pipe(gulp.dest(paths.buildScripts));
  };
  bundler.on('update', rebundle);
  return rebundle();
};

const scriptsDiscovererBuild = () => {
  return browserify('./src/back-office/discoverer.js', { debug: true })
    .transform(babelify, { presets: ["@babel/preset-env", "@babel/preset-react"] })
    .bundle()
    .on('error', function(err) {
      console.error('[gulpfile] Error in scriptsDiscovererBuild task', err.message);
      this.emit('end');
    })
    .pipe(source('back-office-discoverer.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest(paths.buildScripts));
};

const styles = (done) => {
  gulp.src([paths.sass, '!./styles/sass/back-office/**/*.scss'])
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(sass().on('error', sass.logError))
    .pipe(concat('all.css'))
    .pipe(postcss([autoprefixer()])) // Removed deprecated browsers option
    .pipe(rename({ suffix: '.min' }))
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest(paths.buildSass));
  done();
};

const stylesBackOffice = (done) => {
  gulp.src(paths.backOfficeSass)
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(sass().on('error', sass.logError))
    .pipe(concat('back-office.css'))
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest(paths.buildSass));
  done();
};

const jestConfig = {
  rootDir: paths.backOfficeTests
};
const testsBackOffice = (done) => {
  gulp.src(paths.backOfficeTests).pipe(gulpJest({
    "preprocessorIgnorePatterns": [
      "<rootDir>/build/", "<rootDir>/node_modules/"
    ],
    "roots": ["back-office-tests"],
    "automock": false
  }));
  done();
};

const test = (done) => {
  gulp.src(paths.tests).pipe(gulpJest({
    "preprocessorIgnorePatterns": [
      "<rootDir>/build/", "<rootDir>/node_modules/"
    ],
    "roots": ["front-end-tests"],
    "automock": false
  }))
  done();
};

// Watch tasks updated for Gulp 4/5 syntax
const watchBackOfficeScripts = () => gulp.watch(paths.backOfficeScripts, scriptsBackOffice);
const watchDiscovererScripts = () => gulp.watch(paths.discovererScripts, scriptsDiscoverer);
const watchBackOfficeStyles = () => gulp.watch(paths.backOfficeSass, stylesBackOffice);
const watchScripts = () => gulp.watch(paths.scripts, scripts);
const watchStyles = () => gulp.watch(paths.sass, styles);
// Removed watchTests and watchJestTests - testing should be run separately

const watch = gulp.parallel( // Simplified watch task export
  watchBackOfficeScripts,
  watchDiscovererScripts,
  watchBackOfficeStyles,
  watchScripts,
  watchStyles
);

const webserver = (done) => {
  gulp.src('./')
    .pipe(server({
      livereload: false,
      open: true,
      port: 8000 // Set the port to 8000 as requested
    }));
  done();
};

// Build tasks simplified - removed lint, tests, watch, webserver (run separately)
const build = gulp.series(clean, gulp.parallel(
  scriptsBuild,
  scriptsBackOfficeBuild,
  scriptsDiscovererBuild,
  styles,
  stylesBackOffice
));

const buildFrontEnd = gulp.series(clean, gulp.parallel(
  scriptsBuild,
  styles
));

const buildBackOffice = gulp.series(clean, gulp.parallel(
  scriptsBackOfficeBuild,
  scriptsDiscovererBuild,
  stylesBackOffice
));

// Export tasks
exports.clean = clean;
exports.scripts = scripts;
exports.scriptsBuild = scriptsBuild;
exports.styles = styles;
exports.scriptsBackOffice = scriptsBackOffice;
exports.scriptsBackOfficeBuild = scriptsBackOfficeBuild;
exports.stylesBackOffice = stylesBackOffice;
exports.scriptsDiscoverer = scriptsDiscoverer;
exports.scriptsDiscovererBuild = scriptsDiscovererBuild;
exports.test = test; // Keep test export for manual running
exports.testsBackOffice = testsBackOffice; // Keep test export for manual running
exports.webserver = webserver; // Keep webserver export for manual running
exports.watch = watch; // Export watch task

exports.build = build;
exports.buildFrontEnd = buildFrontEnd;
exports.buildBackOffice = buildBackOffice;

exports.default = gulp.series(build, webserver, watch); // Default task: build, start server, watch
exports.fe = gulp.series(buildFrontEnd, webserver, watch); // FE task: build FE, start server, watch
exports.bo = gulp.series(buildBackOffice, webserver, watch); // BO task: build BO, start server, watch
