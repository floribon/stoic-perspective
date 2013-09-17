stoicReady(2, function() {

  define('demoController', ['jquery', 'angular-ui', 'mapperjs', 'stc_dendrogram'], function($, angular, mappers, dendrogramPerspective) {

    var demoData = [
      {id:'flags', name:'Flags', parentId:null},
        {id:'france', name:'France', parentId:'flags', position: 1},
          {id:'fr_blue', name:'Parisian Blue', parentId:'france', color: '#0055A4', position: 1},
          {id:'fr_white', name:'Royal White', parentId:'france', color: '#ddd', position: 2},
          {id:'fr_red', name:'Republican Red', parentId:'france', color: '#EF4135', position: 3},
        {id:'usa', name:'United States', parentId:'flags', position: 2},
          {id:'usa_white', name:'White', parentId:'usa', color: '#ddd', position: 1},
          {id:'usa_red', name:'Old Glory Red', parentId:'usa', color: '#B22234', position: 2},
          {id:'usa_blue', name:'Old Glory Blue', parentId:'usa', color: '#3C3B6E', position: 3},
    ];

    var demoController = function($scope, $element) {

      dendrogramPerspective.error = function(err) {
        if(err) {
          var message = err.message || err;
          $element.text('ERROR: ' + message);
          console.error(err.stack || err);
        }
      }

      dendrogramPerspective.bind($scope, $element, demoData);
    }

    return demoController;
  });
});
