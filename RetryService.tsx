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
  defaultInterval = 3;

  retry(
    cb: () => void,
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
        // The force_retry is called from original caller to see through
        // the expected attempts without being affected by a new error type
        if (this.shouldRetry(e, config) || force_retry) {
          // If backoff cb provided, apply it after first retry
          await delay(this.computeInterval(attempt, interval, backOff));
          execute(attempt + 1, e, true);
        }
        throw err;
      }
    };
    execute(1);
  }

  shouldRetry(error: any, config: RetryConfiguration) {
    const { statusCode, match } = config;

    // block if code config exists and err code exists and err code not in config
    const resHasCode = error && error.response && error.response.status;
    const code = resHasCode ? parseInt(error.response.status, 10) : 0;
    const codeLevel = (code / 100) >> 0;
    const codeMask = `${codeLevel}XX`;
    const raiseCodeException = Boolean(
      resHasCode &&
        statusCode &&
        !(codeMask in statusCode) &&
        !(String(code) in statusCode)
    );
    // block if match config exists and err msg exists and matches
    let resHasMessage = Boolean(error && error.message && match);
    let wordMatchException = Boolean(
      resHasMessage && !error.message.toLowerCase().includes(match)
    );
    if (raiseCodeException || wordMatchException) {
      return false;
    }
    return true;
  }
  trueCount(error: any, config: RetryConfiguration) {
    const { count, statusCode } = config;
    try {
      if (error && error.response && error.response.status && statusCode) {
        const code = parseInt(error.response.status, 10);
        // Todo better dynamic interpretation of mask such as 5X0 or 50X cases
        const codeMask = `${(code / 100) >> 0}XX`;
        const codeMap = statusCode[code] || statusCode[codeMask];
        return codeMap.count;
      } else {
        return count || this.defaultRetryCount;
      }
    } catch (e) {
      return this.defaultRetryCount;
    }
  }
  computeInterval(
    attempt: number,
    interval: number | undefined,
    backOff: Function | undefined
  ) {
    let seconds = this.defaultInterval;
    if (interval && attempt > 1 && backOff) {
      let intervalRef = interval;
      while (attempt - 1 > 0) {
        seconds = backOff(intervalRef);
        intervalRef = seconds;
        attempt--;
      }
    } else if (typeof interval === "number") {
      seconds = interval;
    }
    return seconds * 1000;
  }
}

// let retryService = new RetryService();
// retryService.retry(
//   () => {
//     throw {
//       response: {
//         status: 500,
//         message: "test"
//       }
//     };
//   },
//   {
//     count: 4,
//     match: "permissiondenied",
//     backOff: (n: number) => {
//       return n * n;
//     },
//     interval: 2,
//     statusCode: {
//       "500": {
//         count: 2
//       },
//       "5XX": {
//         count: 3
//       },
//       "404": {
//         count: 5
//       }
//     }
//   }
// );
