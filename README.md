# circle-wait

circle-wait is a CLI utility to block the running of Circle CI jobs in order to
maintain a maximum number of running jobs. This is useful when your build
interacts with external services with impose a maximum level of parallelism.

The utility is written for node (because the project I wanted to use it with was
also written in node.)

To use it, define the `CIRCLE_API_KEY` in your projects environment variables,
so that circle-wait can access the API, then add it as a dependency to your
project:

```shell
npm install --save circle-wait
```

Add the build step into your Circle CI build file:

```yaml
version: 2
jobs:
  builds:
    steps:
      ...

      # Install your dependencies, or at least circle-wait.
      - run: npm install
      - save_cache:
          paths:
            - node_modules
          key: v1-dependencies-{{ checksum "package.json" }}

      # Perform as many local steps as early as possible.
      - run: npm test

      # Do the waiting immediately prior to the step you want to restrain
      # the parallelism of.
      - run:
          name: "Wait for ci"
          command: node_modules/.bin/circle-wait

      - run:
          name: "The thing you want to limit parallelism of"
          command: derp
```