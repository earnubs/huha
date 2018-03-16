const IN_PROGRESS = 'In progress';
const COMPLETED = 'Completed';
const ABANDONED = 'Abandoned';

const DEFAULTS = {
  trackOnGoogleAnalytics: true,
  trackOnIntercom: false,
};

/**
 * Class that will store an individual task to be analysed
 */
class HuhaTask {

  /**
   * Constructor of the HuhTask
   * @param name {string} Name of the task
   * @param options {object} Object containing the configuration of the class. Options available are:
   * - trackOnGoogleAnalytics (Boolean): Indicates if the task need to be tracked on Google Analytics
   * - trackOnIntercom (Boolean): Indicates if the task need to be tracked on Intercom
   */
  constructor(name, options) {
    let mergedOptions = Object.assign(DEFAULTS, options);
    this.name = name;
    this.status = IN_PROGRESS;
    this.effort = 0;
    this.errors = 0;
    this.start = new Date().getTime();
    this.end = null;
    this.trackOnGoogleAnalytics = mergedOptions.trackOnGoogleAnalytics;
    this.trackOnIntercom = mergedOptions.trackOnIntercom;
  }

  /**
   * Increments the count of effort in 1
   */
  addInteraction() {
    this.effort++;
  }

  /**
   * Increments the count of errors in 1
   */
  addError() {
    this.errors++;
  }

  /**
   * Marks the task as finished according to the given status and then it is tracked.
   * @param status {string} New status of the task
   */
  finish(status) {
    if (this.status === IN_PROGRESS) {
      this.end = new Date().getTime();
      this.status = status;
      this.track();
    }
  }

  /**
   * Marks the task as completed
   */
  complete() {
    this.finish(COMPLETED);
  }

  /**
   * Marks the task as abandoned
   */
  abandon() {
    this.finish(ABANDONED);
  }

  /**
   * Tracks the task in external services like Google Analytics or Intercom
   */
  track() {
    if (this.trackOnGoogleAnalytics) {
      this.sendToGoogleAnalytics();
    }

    if (this.trackOnIntercom) {
      this.sendToIntercom();
    }
  }

  /**
   * Gets the elapsed time of the task
   * @returns {number}
   */
  get time() {
    let time = 0;
    if (this.end) {
      time = this.end - this.start;
    }
    return time;
  }

  /**
   * Tracks the task in Google Analytics using an User Timing (for indicating the elapsed time) and 2 events (for
   * indicating the errors and the effort)
   */
  sendToGoogleAnalytics() {
    if (typeof ga !== 'undefined') {
      ga('send', 'timing', this.name, this.status, this.time, 'Time on task');
      ga('send', 'event', this.name, this.status, 'Error', this.errors);
      ga('send', 'event', this.name, this.status, 'Effort', this.effort);
    }
  }

  /**
   * Tracks the task using a single Event in Intercom. The elapsed time, the errors and the effort are included as
   * metadata
   */
  sendToIntercom() {
    if (typeof Intercom !== 'undefined') {
      Intercom('trackEvent', this.name, {
        errors: this.errors,
        effort: this.effort,
        time: this.time,
        status: this.status,
      });
    }
  }

}

/**
 * Class that will store all the tasks that are needed to be analysed
 */
class Huha {
  /**
   * Constructor of the Huha class
   */
  constructor() {
    this.tasks = [];
    this.setUpEvents();
  }

  /**
   * Changes the configuration
   * @param options {object} Object containing the configuration of the class. Options available are:
   * - trackOnGoogleAnalytics (Boolean): Indicates if the task need to be tracked on Google Analytics
   * - trackOnIntercom (Boolean): Indicates if the task need to be tracked on Intercom
   */
  configure(options) {
    let mergedOptions = Object.assign(DEFAULTS, options);
    this.trackOnGoogleAnalytics = mergedOptions.trackOnGoogleAnalytics;
    this.trackOnIntercom = mergedOptions.trackOnIntercom;
  }

  /**
   * Creates and returns a task with the given name. If another task with the same name already exists, it will be
   * abandoned
   * @param name {string} Name of the task.
   * @returns {HuhaTask}
   */
  createTask(name) {
    let existingTask = this.getTask(name);
    if (typeof existingTask !== 'undefined') {
      existingTask.abandon();
    }

    let huhaTask = new HuhaTask(name, {
      trackOnGoogleAnalytics: this.trackOnGoogleAnalytics,
      trackOnIntercom: this.trackOnIntercom,
    });

    this.tasks.push(huhaTask);

    return huhaTask;
  }

  /**
   * Gets an in progress task giving its name
   * @param name {string} Name of the task
   * @returns {HuhaTask}
   */
  getTask(name) {
    return this.tasks.find(task => task.name === name && task.status === IN_PROGRESS);
  }

  /**
   * Adds all the event listeners needed
   */
  setUpEvents() {
    // Abandon all tasks in progress if the user exits the page
    window.addEventListener('beforeunload', event => {
      this.abandonInProgressTasks();
    });

    // Listen to events defined directly on the DOM
    const events = ['click', 'focus', 'change'];
    events.forEach(eventName => {
      document.querySelector('body').addEventListener(eventName, evt => {
        this.registerEvent(eventName, evt.target)
      }, true);
    })
  }

  /**
   * Checks if the given element has been initialised directly in the DOM to be considered in a task. If that is the
   * case and the trigger event defined on it is the same the received expected event, it will register its action in
   * the task defined on the element
   * @param capturedEvent {string} Name of the event captured. If this event is the same than the one defined on the
   * element, the action will be registered
   * @param element {object} Element that has triggered the captured event
   */
  registerEvent(capturedEvent, element) {
    const dataset = element.dataset;
    if ('huhaTask' in dataset) {
      const taskName = dataset.huhaTask;
      const actionTrigger = dataset.huhaTrigger;
      const eventType = dataset.huhaEvent;
      if (capturedEvent === actionTrigger) {
        if (eventType === 'start') {
          this.createTask(taskName);
        } else {
          let task = this.getTask(taskName);
          if (eventType === 'complete') {
            task.complete();
          } else if (eventType === 'abandon') {
            task.abandon();
          } else if (eventType === 'interaction') {
            task.addInteraction();
          } else if (eventType === 'error') {
            task.addError();
          }
        }
      }
    }
  }

  /**
   * Abandons all the tasks that are in progress
   */
  abandonInProgressTasks() {
    let pendingTasks = this.tasks.filter(task => task.status === IN_PROGRESS);
    pendingTasks.forEach(task => task.abandon());
  }
}

let huha = new Huha();
window.huha = huha;

export default {
  huha,
  Huha,
}