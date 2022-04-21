"use strict";

const async = require("async"),
  fs = require("fs"),
  path = require("path"),
  pindexer = require("cpio-pindexer"),
  _ = require("lodash"),
  CronJob = require("cron").CronJob;

const Problem = require("../../common/models/problem");

const INDEX_PROBLEMS_CRON = "00 00 04 * * *";
const INDEX_PROBLEMS_TZ = "America/Recife";

let problems = {};

function runProblemsIndexer() {
  pindexer.setReturnSize(10);
  async.waterfall(
    [
      (next) => {
        Problem.find({}, next);
      },
      (_problems, next) => {
        async.eachSeries(
          _problems,
          (item, callback) => {
            if (!problems[item._id] && item.imported) {
              problems[item._id] = true;
              pindexer.addProblem(item);
            }
            return async.setImmediate(callback);
          },
          next
        );
      },
    ],
    () => {
      console.log("Finished indexing problems.");
    }
  );
}

let job = new CronJob({
  cronTime: INDEX_PROBLEMS_CRON,
  onTick: runProblemsIndexer,
  timeZone: INDEX_PROBLEMS_TZ,
  runOnInit: true,
});
job.start();

exports.searchProblems = (req, res) => {
  let substr = req.params.query;
  let insertedProblems = req.body.problems || [];
  if (!_.isString(substr) || !_.isArray(insertedProblems))
    return res.sendStatus(400);
  if (substr.length < 3 || substr.length > 50 || insertedProblems.length > 26)
    return res.sendStatus(400);
  let result = pindexer.match(substr, insertedProblems);
  return res.json({
    list: result,
  });
};

exports.get = async (req, res) => {
  let id = req.params.id;
  try {
    let problem = await Problem.findById(id).select(
      "name oj id url originalUrl source timelimit memorylimit inputFile outputFile imported isPdf"
    );
    if (!problem) {
      return res.sendStatus(404);
    }
    return res.json(problem);
  } catch (err) {
    console.log(err);
    return res.sendStatus(500);
  }
};

exports.isIndexed = (array) => {
  if (!_.isArray(array)) return false;
  for (let i = 0; i < array.length; i++) {
    const id = array[i];
    if (_.isString(id) && !problems[id]) return false;
  }
  return true;
};
