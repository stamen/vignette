#!/usr/bin/env node
"use strict";

var assert = require("assert"),
    exec = require("child_process").exec,
    fs = require("fs"),
    path = require("path"),
    util = require("util");

var abaculus = require("abaculus"),
    async = require("async"),
    mkdirp = require("mkdirp"),
    nopt = require("nopt"),
    range = require("range").range,
    tilelive = require("tilelive");

var types = {
  config: String,
  "output-dir": String,
  require: Array,
  width: Number,
  height: Number
};

var shorthands = {
  c: "--config",
  o: "--output-dir",
  r: "--require",
  w: "--width",
  h: "--height"
};

var conf = nopt(types, shorthands),
    argv = conf.argv.remain,
    uri = argv.shift();

// default output directory to the current directory
conf["output-dir"] = conf["output-dir"] || ".";

assert.ok(conf.config, "A configuration is required.");
assert.ok(conf.width, "An image width is required.");
assert.ok(conf.height, "An image height is required.");
assert.ok(uri, "A tilelive URI is required.");

// require unregistered tilelive modules
require("./lib/modules")(tilelive, {
  require: conf.require
});

var places = require(path.resolve(conf.config));

// If it's just a plain http url (that is, we're not using tilejson+http) then we need to use another approach,
// not tilelive. This is a bit of a hack, but if you have tile-stitch installed in this repo, it will use the
// tile-stitch/stitch executable to download tiles and combined them.

// See http://github.com/ericfischer/tile-stitch

if (/^http/.test(uri)) {

  // TODO: check if tile-stitch/stitch exists

  async.eachSeries(places.features, function(place, done) {
    var name = place.properties.name;
    console.log(name);

    return async.eachSeries(range(place.properties.minzoom, place.properties.maxzoom + 1), function(zoom, done) {
      console.log("Stitching %s at z%d...", name, zoom);
      //return true;

      var targetDir = path.resolve(path.join(conf["output-dir"], name)),
          targetPath = path.join(targetDir, util.format("z%d.png", zoom));
      return mkdirp(targetDir, function(err) {
        if (err) {
          return done(err);
        }
        var command = 'tile-stitch/stitch -o '
          + targetPath
          + ' -c --'
          + ' ' + place.geometry.coordinates[1]
          + ' ' + place.geometry.coordinates[0]
          + ' ' + conf.width
          + ' ' + conf.height
          + ' ' + zoom
          + ' "' + uri + '"';
        return exec(command, function(error,stdout,stderr) {
            if (error)
              console.log("err", error);
              return done(err);
            console.log(`stdout: ${stdout}`);
            console.log(`stderr: ${stderr}`);
            return done;
          });
      });

    }, done);
  }, function(err) {
    console.log("done");
    if (err) {
      throw err;
    }
  });
} else {
  async.waterfall([
    async.apply(tilelive.load, uri),
    function(source, done) {
      return async.eachSeries(places.features, function(place, done) {
        var name = place.properties.name;

        return async.eachSeries(range(place.properties.minzoom, place.properties.maxzoom + 1), function(zoom, done) {
          console.log("Rendering %s at z%d...", name, zoom);

          return abaculus({
            zoom: zoom,
            center: {
              x: place.geometry.coordinates[0],
              y: place.geometry.coordinates[1],
              w: conf.width,
              h: conf.height
            },
            getTile: source.getTile.bind(source)
          }, function(err, image, headers) {
            if (err) {
              console.warn(err);
              // ignore
              return done();
            }

            var targetDir = path.resolve(path.join(conf["output-dir"], name)),
                targetPath = path.join(targetDir, util.format("z%d.png", zoom));

            return mkdirp(targetDir, function(err) {
              if (err) {
                return done(err);
              }

              return fs.writeFile(targetPath, image, done);
            });

          });

        }, done);
      }, done);
    }
  ], function(err) {
    if (err) {
      throw err;
    }
  });
}

