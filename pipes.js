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

function sendUntilDone(module, expectations, channel, message, events) {
  var deferred = Q.defer()

  var events = events || []

  // 1. Expectations always have first dibs on messages sent
  // to channels, and will subvert any other routes
  // TODO: multiple
  var expectationsOnChannel = filter(expectations, { channel: channel })
  if (expectationsOnChannel.length > 0) {
    var match = find(expectationsOnChannel, function(expectation) {
      // I'm not entirely sure about this comparison, since
      // it makes an assumption that two objects with the same
      // properties will be stringified identically.
      return nodeDeepEqual(expectation.message, message)
    })
    if (match) {
      events.push({
        received: {
          channel: channel,
          message: message
        },
        expectation: match,
        sent: match.send
      })
      if(match.send) {
        sendUntilDone(module, expectations, match.send.channel, match.send.message, events)
          .then(deferred.resolve)
      } else {
        deferred.resolve(events)
      }
    } else {
      deferred.resolve(events)
    }


  } else {

    var receivers = [];

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
        events.push({
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

    if (receivers.length === 0) {
      events.push({
        received: {
          channel: channel,
          message: message
        },
        noRoute: true
      })
    }

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
          events.push({
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
          sendUntilDone(module, expectations, sendChannel, sendMessage, events)
            .then(deferredSend.resolve)
        }
      }
      timeoutHandle = setTimeout(function() {
        timedOut = true
        events.push({
          received: {
            channel: channel,
            message: message
          },
          transform: {
            name: transform.name,
            timedOut: true
          }
        })
        deferredSend.resolve(events)
      }, 2000)
      transform(work)
    })
    return Q.all(sendPromises).then(function() { return events })
  }

  return deferred.promise
}

function runWorld(module, world) {
  return sendUntilDone(module, world.expectations, 'start', true).then(function(events) {

    var metExpectations =
      pluck(filter(events, 'expectation'), 'expectation')

    return {
      world: { name: world.name },
      events: events,
      unmet: difference(world.expectations, metExpectations)
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