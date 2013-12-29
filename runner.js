var Q = require('q')
var find = require('mout/array/find')
var partial = require('mout/function/partial')
var deepEquals = require('mout/object/deepEquals')

function findTransformByName(module, transformName) {
  return find(module.transforms, function(t) {
    return t.name === transformName
  })
}

function sendUntilDone(module, expectations, channel, message, events) {
  var deferred = Q.defer()

  var events = events || []

  var timelineEvent = {}
  events.push(timelineEvent)

  timelineEvent.received = {
    channel: channel,
    message: message
  }

  // 1. Expectations always have first dibs on messages sent
  // to channels.
  var expectation = find(expectations, { channel: channel })
  if (expectation) {
    timelineEvent.expectation = {
      message: expectation.message,
      match: deepEquals(expectation.message, message)
    }
    deferred.resolve(events)
  } else {

    // 2. Try implicit routing if the channel name
    // exactly matches transform name
    var transform = findTransformByName(module, channel)

    // 3. See if this channel is routed to a transform
    // explicitly by one of the routes
    if (!transform) {
      var route = find(module.routes, { channel: channel })
      if (route)
        transform = findTransformByName(module, route.transform)
    }

    if (transform) {
      timelineEvent.transform = transform.name
      var work = {
        message: message,
        done: function(channel, message) {
          timelineEvent.sent = {
            channel: channel,
            message: message
          }
          sendUntilDone(module, expectations, channel, message, events).then(deferred.resolve)
        }
      }
      transform(work)
    } else {
      // Could not route to a transform.
      deferred.resolve(events)
    }
  }

  return deferred.promise
}

function runWorld(module, world) {
  return sendUntilDone(module, world.expectations, 'start', true).then(function(timeline) {
    return {
      world: { label: world.label },
      events: timeline
    }
  })
}

var Runner = {
  run: function(module) {
    var runWorldInModule = partial(runWorld, module)
    var whenTimelines = Q.all(module.worlds.map(runWorldInModule))
    return whenTimelines.then(function(timelines) {
      return {
        timelines: timelines
      }
    })

  }
}

module.exports = Runner