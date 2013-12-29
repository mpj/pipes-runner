var Q = require('q')

var Runner = {
  run: function(module) {
    var deferred = Q.defer()
    deferred.resolve({
      timelines: [{
        world: { label: module.worlds[0].label },
        events: [
          {
            sent: {
              channel: 'start',
              message: true
            }
          },
          {
            received: {
              channel: 'start',
              message: true
            },
            transform: 'add_five_and_seven',
            sent: {
              channel: 'add',
              message: {
                a: 5,
                b: 7
              }
            }
          }
        ]
      }]
    })

    return deferred.promise
  }
}

module.exports = Runner