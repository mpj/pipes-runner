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
var difference = require('mout/array/difference')

function findTransformByName(module, transformName) {
  return find(module.transforms, function(t) {
    return t.name === transformName
  })
}

function sendUntilDone(module, expectations, channel, message, context) {


  context = context || { events: [], deliveries: [] }

  context.deliveries.push({
    channel: channel,
    message: message
  })

  var receivers = [];

  // 1. Expectations always have first dibs on messages sent
  // to channels, and will subvert any other routes
  // TODO: multiple
  var expectationsOnChannel = filter(expectations, { channel: channel })

  filter(expectations, function(expectation) {
    return expectation.channel === channel &&
           nodeDeepEqual(expectation.message, message)
  }).forEach(function(match) {
    receivers.push(function expect(work) {
      if (match.send)
        work.done(match.send.channel, match.send.message)
      else
        work.done('ok', true)
    })
  })

  // 2. Try implicit routing if the channel name
  // exactly matches transform name
  var implicitTransform = findTransformByName(module, channel)
  if (implicitTransform)
    receivers.push(implicitTransform)

  // 3. See if this channel is routed to a transform
  // explicitly by routes
  var routesOnChannel = filter(module.routes, { channel: channel })
  routesOnChannel.forEach(function(route) {
    var transform = findTransformByName(module, route.transform)
    if (!transform) {
      context.events.push({
        received: {
          channel: channel,
          message: message
        },
        transform: {
          name: route.transform,
          notFound: true
        }
      })
    } else {
      receivers.push(transform)
    }
  })

  var sendPromises = []
  receivers.forEach(function(transform) {

    var deferredSend = Q.defer()
    sendPromises.push(deferredSend.promise)
    var timeoutHandle;
    var timedOut = false
    var work = {
      message: message,
      done: function(sendChannel, sendMessage) {
        if(timedOut) return;
        clearTimeout(timeoutHandle)
        context.events.push({
          received: {
            channel: channel,
            message: message
          },
          transform: {
            name: transform.name
          },
          sent: {
            channel: sendChannel,
            message: sendMessage
          }
        })
        sendUntilDone(module, expectations, sendChannel, sendMessage, context)
          .then(deferredSend.resolve)
      }
    }
    timeoutHandle = setTimeout(function() {
      timedOut = true
      context.events.push({
        received: {
          channel: channel,
          message: message
        },
        transform: {
          name: transform.name,
          timedOut: true
        }
      })
      deferredSend.resolve(context.events)
    }, 2000)
    transform(work)
  })
  return Q.all(sendPromises).then(function() { return context })


}

function runWorld(module, world) {
  return sendUntilDone(module, world.expectations, 'start', true).then(function(context) {


    var handledDeliveries = pluck(context.events, 'received')

    // FIXME: This is a bit primitive and will probably be messed up
    // if we start having multiple expectations on same channel + message,
    // i.e like expecting first and second and so forth.
    var unmetExpectations = reject(world.expectations, function(expectation) {
      return !!find(handledDeliveries, function(handled) {
        return nodeDeepEqual(handled, {
          channel: expectation.channel,
          message: expectation.message
        })
      })
    })

    var unHandledDeliveries = reject(context.deliveries, function(sent) {
      return !!find(handledDeliveries, function(handled) {
        return nodeDeepEqual(handled, sent)
      })
    })

    return {
      world: { name: world.name },
      events: context.events,
      unmet: unmetExpectations,
      unhandled: unHandledDeliveries
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