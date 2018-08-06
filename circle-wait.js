#!/usr/bin/env node
const fetch = require('node-fetch');

main();

function usage() {
  console.warn('Usage: (ENVVARS)', process.argv0);
  console.warn();
  console.warn('* Required envvars (configure in project settings):');
  console.warn('    CIRCLE_API_KEY=asdf...');
  console.warn('* CircleCI envvars (required, but already in Circle CI 2.0 build envs):');
  console.warn('    CIRCLE_PROJECT_USERNAME=org-user');
  console.warn('    CIRCLE_PROJECT_REPONAME=my-repo');
  console.warn('    CIRCLE_BUILD_NUM=123');
  console.warn('* Optional envvars:');
  console.warn('    CIRCLE_PROJECT_VCS=github');
}

function main() {
  const waitOpts = {
    // Repo identification.
    apiKey: process.env.CIRCLE_API_KEY,
    vcs: process.env.CIRCLE_PROJECT_VCS,
    user: process.env.CIRCLE_PROJECT_USERNAME,
    repo: process.env.CIRCLE_PROJECT_REPONAME,

    // Job identification.
    job: process.env.CIRCLE_BUILD_NUM,

    // Scheduling. TODO: Make options.
    maxParallel: 1,
    checkInterval: 1000, // 1 second.
    timeout: 30 * 60 * 1000, // 30 minutes.
  };

  if (!waitOpts.apiKey || !waitOpts.user || !waitOpts.repo || !waitOpts.job) {
    usage();
    process.exit(1);
  }

  waitOpts.job = parseInt(waitOpts.job, 10);
  if (!(waitOpts.job > 0)) {
    console.warn('CIRCLE_BUILD_NUM should be an integer greater than zero.');
    usage();
    process.exit(0);
  }

  if (!waitOpts.vcs) {
    waitOpts.vcs = 'github';
    console.warn('Envvar CIRCLE_PROJECT_VCS not set. Default into github.');
  }

  waitForCI(waitOpts)
    .then(function() {
      console.log('Our turn! 🎉');
      process.exit(0);
    })
    .catch(function(e) {
      console.warn(e);
      process.exit(1);
    });
}

/**
 * waitForCI returns a promise which resolves when the given job is at the head
 * of the build queue.
 */
function waitForCI(opts) {
  return Promise.race([
    // Time out waiting for build opportunity.
    new Promise(function(_, reject) {
      setTimeout(reject.bind(this, 'Timed out after ' + opts.timeout + ' milliseconds.'), opts.timeout);
    }),

    // Resolve once this is the latest build.
    new Promise(function(resolve, reject) {
      const tick = ticker();
      const interval = setInterval(check, opts.checkInterval);
      check();

      function check() {
        jobNumbers(opts)
          .then(function(jobs) {
            // Check whether we need to wait for longer.
            if (jobs.length >= opts.maxParallel) {
              const queueTail = jobs[opts.maxParallel - 1];
              if (queueTail < opts.job) {
                console.log(tick() + ' ' + opts.maxParallel + '/' + opts.maxParallel + ' jobs are running, up to job ' + queueTail + '. ' + (opts.job - queueTail) + ' to go. Waiting...');
                return;
              }
            }

            // Start the build.
            clearInterval(interval);
            resolve();
          })
          .catch(function(e) {
            reject(e);
          });
      }
    })
  ]);
}

/**
 * jobNumbers returns the numbers of all running jobs.
 */
function jobNumbers(opts) {
  const url = 'https://circleci.com/api/v1.1/project/' + encodeURIComponent(opts.vcs) + '/' + encodeURIComponent(opts.user) + '/' + encodeURIComponent(opts.repo) + '?filter=running';
  return fetch(url + '&circle-token=' + encodeURIComponent(opts.apiKey))
    .then(res => res.json())
    .then(function(jobs) {
      jobs = jobs.map(j => j.build_num);
      jobs.sort();
      return jobs;
    });
}

function ticker() {
  let ticks = ['🕛', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚'];
  return function() {
    ticks = ticks.slice(1).concat(ticks[0]);
    return ticks[0];
  }
}
