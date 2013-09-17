stoicReady(10, function() {

  require(['settings', 'angular-ui', 'config-mapper', 'mapperjs', 'directives', 'demoController'], function(settings, angular, config, mappers, directives, demoController) {

    config.done(function() {
      // mdCache.init(function(err) {
        angular.element(document).ready(function () {
          angular.module('demo', ['ui', 'directives']).controller('demoController', demoController);
          angular.bootstrap('#container', ['demo']);
        });
      // });
    });

  });
});
