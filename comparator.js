#!/usr/bin/env node
"use strict";

var assert = require("assert"),
    fs = require("fs"),
    path = require("path"),
    tmp = require("tmp"),
    util = require("util");

var async = require("async"),
    mkdirp = require("mkdirp"),
    nopt = require("nopt"),
    range = require("range").range;

const exec = require('child_process').exec;

var types = {
  config: String,
  "input-dir-a": String,
  "input-dir-b": String,
  "output-dir": String,
  "joined-output-dir": String,
  require: Array
};

var shorthands = {
  c: "--config",
  a: "--input-dir-a",
  b: "--input-dir-b",
  o: "--output-dir",
  j: "--joined-output-dir",
  r: "--require"
};

var conf = nopt(types, shorthands),
    argv = conf.argv.remain,
    uri = argv.shift();

// default output directory to the current directory
conf["output-dir"] = conf["output-dir"] || ".";

assert.ok(conf.config, "A configuration is required.");

var places = require(path.resolve(conf.config));

async.waterfall([
  function(source, done) {
    return async.eachSeries(places.features, function(place, done) {
      var name = place.properties.name;

      return async.eachSeries(range(place.properties.minzoom, place.properties.maxzoom + 1), function(zoom, done) {
        console.log("Diffing %s at z%d...", name, zoom);
        var input1Dir = path.resolve(path.join(conf["input-dir-a"], name)),
            input1Path = path.join(input1Dir, util.format("z%d.png", zoom));

        var input2Dir = path.resolve(path.join(conf["input-dir-b"], name)),
            input2Path = path.join(input2Dir, util.format("z%d.png", zoom));

        var targetDir = path.resolve(path.join(conf["output-dir"], name)),
            targetPath = path.join(targetDir, util.format("z%d.png", zoom));

        var joinedDir = path.resolve(path.join(conf["joined-output-dir"], name)),
            joinedPath = path.join(joinedDir, util.format("z%d.png", zoom));

        return mkdirp(targetDir, function(err) {
          if (err) {
            return done(err);
          }

          // Assumes ImageMagick is installed

          // create a third image showing the difference between the first two

          exec(`composite ${input1Path} ${input2Path} -compose difference ${targetPath}`, (error, stdout, stderr) => {
            if (stdout) console.log(`stdout: ${stdout}`);
            if (stderr) console.log(`stderr: ${stderr}`);
            if (error) {
              console.error(`exec error: ${error}`);
              return done(error);
            }

            return mkdirp(joinedDir, function(err) {
              if (err) {
                return done(err);
              }

              var tmpPath = tmp.tmpNameSync();

              // create a fourth image that appends the first three side-by-side

              exec(`convert ${input1Path} ${input2Path} ${targetPath} +append ${tmpPath}`, (error, stdout, stderr) => {
                if (stdout) console.log(`stdout: ${stdout}`);
                if (stderr) console.log(`stderr: ${stderr}`);
                if (error) {
                  console.error(`exec error: ${error}`);
                  return done(error);
                }

                exec(`convert ${tmpPath} -gravity southwest -stroke none -fill firebrick -font Arial -pointsize 20 -annotate +10+10 "end of phase 1                                                                               end of phase 2                                                                                 difference" ${joinedPath}`, (error, stdout, stderr) => {
                  if (stdout) console.log(`stdout: ${stdout}`);
                  if (stderr) console.log(`stderr: ${stderr}`);
                  if (error) {
                    console.error(`exec error: ${error}`);
                    return done(error);
                  }
                });


              });
              return done();
            });

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
