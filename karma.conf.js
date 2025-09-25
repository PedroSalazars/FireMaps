// karma.conf.js
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      jasmine: { random: false },
      clearContext: false // deja visible el reporte en el navegador
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage'),
      reporters: [{ type: 'html' }, { type: 'text-summary' }],
      fixWebpackSourcePaths: true
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['Chrome'],
    restartOnFileChange: true
  });
};
