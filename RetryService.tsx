// Configuration Structure
interface RetryConfiguration {
  count: number;
  statusCode?: {
    [key: string]: {
      count: number;
    };
  };
  match?:
    | {
        value: string;
        isRegex: boolean;
      }
    | string;
  backOff?: Function;
  interval?: number;
}

export class RetryService {
  defaultRetryCount = 4;
  defaultInterval = 3000;

  retry(
    cb: Function,
    config: RetryConfiguration = {
      count: this.defaultRetryCount,
      interval: this.defaultInterval
    }
  ) {
    let { interval, backOff } = config;
    const delay = (interval: number) =>
      new Promise((resolve) => setTimeout(resolve, interval));
    const execute = async (
      attempt: number = 0,
      err: any = null,
      force_retry: boolean = false
    ) => {
      if (attempt > this.trueCount(err, config)) throw err;
      try {
        cb();
      } catch (e) {
        // This will block before retry count if new paramters are sent
        // The force_retry is called from original caller to see through
        // the expected attempts.
        if (this.shouldRetry(e, config) || force_retry) {
          // If backoff cb provided, apply it after first retry
          let y = this.computeInterval(interval, backOff);
          await delay(y);
          execute(attempt + 1, e, true);
        }
        throw err;
      }
    };
    execute(1);
  }

  shouldRetry(error: any, config: RetryConfiguration) {
    let { statusCode, match } = config;

    // If has error code and matches config
    let resHasCode = error && error.response && error.response.status;
    let code = resHasCode ? parseInt(error.response.status, 10) : 0;
    let codeLevel = (code / 100) >> 0;
    let codeMask = `${codeLevel}XX`;
    let statusCodeIsOkay =
      resHasCode &&
      statusCode &&
      code &&
      (codeMask in statusCode || code in statusCode);

    // if has err msg and matches, just a simple check no regex for now
    let resHasMessage = error && error.message && match;
    let hasAndIsWordMatch =
      resHasMessage && error.message.toLowerCase().includes(match);

    return statusCodeIsOkay && resHasMessage && hasAndIsWordMatch;
  }
  trueCount(error: any, config: RetryConfiguration) {
    try {
      if (config && config.statusCode) {
        const code = parseInt(error.response.status, 10);
        const codeMask = `${(code / 100) >> 0}XX`;
        return config.statusCode[codeMask] || config.statusCode[code];
      } else {
        return config.count || this.defaultRetryCount;
      }
    } catch {
      return this.defaultRetryCount;
    }
  }
  computeInterval(interval: number | undefined, backOff: Function | undefined) {
    return (
      (interval && interval > 0 && backOff ? backOff(interval) : interval) |
      this.defaultInterval
    );
  }
}
/**
 *  Test
  let retryService = new RetryService();
  retryService.retry(
    () => {
      throw new TypeError("UNKNOWN ERROR");
    },
    {
      count: 4,
      match: "apple",
      backOff: (n: number) => {
        return n * n;
      },
      interval: 700
    }
  );
 */
