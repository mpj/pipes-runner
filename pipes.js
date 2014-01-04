var Q = require('q')
Q.longStackSupport = true;
var find = require('mout/array/find')
var filter = require('mout/array/filter')
var reject = require('mout/array/reject')
var pluck = require('mout/array/pluck')
var partial = require('mout/function/partial')
var nodeDeepEqual = require('deep-equal')
var teaMerge = require('tea-merge');
var deepClone = require('mout/lang/deepClone')
var toArray = require('mout/lang/toArray')
var isArray = require('mout/lang/isArray')
var compose = require('mout/function/compose')
var prop = require('mout/function/prop')
// Cannot user mouts property filters because name on functions
// is a special property somehow and mout doesnt support
function findByNameProperty(array, name) {
  return find(array, function(t) {
    return t.name === name
  })
}

function sendUntilDone(module, expectations, delivery, context) {

  context = context || { events: [], deliveries: [] }
  context.deliveries.push(delivery)

  // Create expect transforms for expectations on this channel
  // and add them to the receivers
  var receivers = filter(expectations, function(expectation) {
    return nodeDeepEqual(expectation.delivery, delivery)
  }).map(function(expectation) {
    return function expect(work) {
      if (expectation.send)
        work.done(expectation.send)
      else
        work.done('ok', true)
    }
  })

  // Implicitly route messages sent to channels with the exact
  // same name as a transform.
  var implicitTransform = findByNameProperty(module.transforms, delivery[0])
  if (implicitTransform) receivers.push(implicitTransform)

  // Finally, add the explicitly routed transforms for execution.
  var routesOnChannel =
  filter(module.routes, function(route) {
    return route.delivery[0] === delivery[0]
  }).forEach(function(route) {
    var transform = findByNameProperty(module.transforms, route.transform)
    if (!transform) {
      context.events.push({
        received: delivery,
        transform: { name: route.transform },
        error: { notFound: true }
      })
    } else {
      receivers.push(transform)
    }
  })

  var transformPromises = []
  receivers.forEach(function(transform) {

    var transformComplete = Q.defer()
    transformPromises.push(transformComplete.promise)

    // Disallow transforms to execute for more than 2000ms
    var timeoutHandle;
    var timedOut = false
    timeoutHandle = setTimeout(function() {
      timedOut = true
      context.events.push({
        received: delivery,
        transform: { name: transform.name },
        error: { timedOut: true }
      })
      transformComplete.resolve(context.events)
    }, 2000)

    // Create the work object that we're going to send into
    // the transform.
    var work = {
      message: delivery[1],
      done: function() {
        var transformDelivery = isArray(arguments[0]) ? arguments[0] : toArray(arguments)
        if(timedOut) {
          // Transform has already timed out, don't
          // create an event from whatever comes back.
          return;
        }
        // Okay, we got a before timed out, cancel the timeout.
        clearTimeout(timeoutHandle)

        context.events.push({
          received: delivery,
          transform: { name: transform.name },
          sent: transformDelivery
        })
        sendUntilDone(module, expectations, transformDelivery, context)
          .then(transformComplete.resolve)
      }
    }
    transform(work)
  })
  return Q.all(transformPromises).then(function() { return context })


}

function runWorld(module, world) {
  return sendUntilDone(module, world.expectations, ['start', true]).then(function(context) {

    function isHandled(delivery) {
      return !!find(pluck(context.events, 'received'), partial(nodeDeepEqual, delivery))
    }

    return {
      world: { name: world.name },
      events: context.events,
      // FIXME: Finding unmet expectations this way is a bit primitive and
      // will probably be messed up if we start having multiple expectations
      // on same channel + message, i.e like expecting first and second and so forth.
      unmet: reject(world.expectations, compose(isHandled, prop('delivery'))),
      unhandled: reject(context.deliveries, isHandled)
    }
  })
}

function moduleRunner(module) {
  return { runWorld: partial(runWorld, module) }
}

// Extend a base module with more properties.
// Will return a copy of the original module
// TODO: move this into pipes?
var extendModule = function(module, extensions) {
  return teaMerge(deepClone(module), extensions)
}

module.exports = {
  module: moduleRunner,
  extend: extendModule
}