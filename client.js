var pipes      = require('./pipes');
var $          = require('jquery-browserify');
var Handlebars = require('handlebars');

var client = new Faye.Client('http://localhost:8000/');
var source   = $("#main-template").html();
var template = Handlebars.compile(source);

var createViewmodel = require('./timeline-view-model');

var currentViewModel;

function onBody(body) {
  $(".main-template-target").html('Running...')
  var module;
  try {
    module = eval('('+body+')')
  } catch(e) {
    $(".main-template-target").html("Error evaluating module", e.message)
    return
  }


  pipes.module(module)
  .runWorld((module.worlds && module.worlds[0]) || {})
  .then(function(timeline) {
    if(currentViewModel)
      currentViewModel.onChange = null;
    currentViewModel = createViewmodel(timeline)


    function render() {
      $(".main-template-target").html(template(currentViewModel))
    }
    render()
    currentViewModel.onChange = render
  })

}


$(document).ready(function() {
  $.ajax({ type: 'GET', url: '/body', success: onBody });
  client.subscribe('/body', onBody);

  $(document).keydown(function(e){
    if (e.keyCode === 40) currentViewModel.arrowDown();
    if (e.keyCode === 38) currentViewModel.arrowUp();
  });
})
