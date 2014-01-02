var pipes      = require('./pipes');
var $          = require('jquery-browserify');
var Handlebars = require('handlebars');

var client = new Faye.Client('http://localhost:8000/');
var source   = $("#main-template").html();
var template = Handlebars.compile(source);

var createViewmodel = require('./timeline-view-model');

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
    var viewmodel = createViewmodel(timeline)
    var html = template(viewmodel)
    $(".main-template-target").html(html)
  })

}

$(document).ready(function() {
  $.ajax({ type: 'GET', url: '/body', success: onBody });
  client.subscribe('/body', onBody);
})
