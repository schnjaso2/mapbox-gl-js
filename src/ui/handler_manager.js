// @flow

import {MapMouseEvent, MapTouchEvent, MapWheelEvent} from '../ui/events';
import DOM from '../util/dom';
import type Map from './map';
import Handler from './handler/handler';
import {extend} from '../util/util';


class HandlerManager {
  _map: Map;
  _el: HTMLElement;
  _handlers: Array<Handler>;

  /**
   * @private
   */
  constructor(map: Map, options?: Object) {
    this._map = map;
    this._el = this._map.getCanvasContainer();
    this._handlers = [];

    // Bind touchstart and touchmove with passive: false because, even though
    // they only fire a map events and therefore could theoretically be
    // passive, binding with passive: true causes iOS not to respect
    // e.preventDefault() in _other_ handlers, even if they are non-passive
    // (see https://bugs.webkit.org/show_bug.cgi?id=184251)
    this.addTouchListener('touchstart', {passive: false});
    this.addTouchListener('touchmove', {passive: false});
    this.addTouchListener('touchend');
    this.addTouchListener('touchcancel');

    this.addMouseListener('mousedown');
    this.addMouseListener('mouseup');
  }

  list() {
    return this._handlers.map(([name, handler]) => name);
  }

  get length() {
    return this._handlers.length;
  }

  add(handlerName: string, handler: Handler) {
    if (!handlerName || !(/^[a-z]+[a-zA-Z]*$/.test(handlerName))) throw new Error('Must provide a valid handlerName string');
    if (!handler || !(handler instanceof Handler)) throw new Error('Must provide a valid Handler instance');

    if (this[handlerName]) throw new Error(`Cannot add ${handlerName}: a handler with that name already exists`);
    for (const [existingName, existingHandler] of this._handlers) {
      if (existingHandler === handler) throw new Error(`Cannot add ${handler} as ${handlerName}: handler already exists as ${existingName}`);
    }

    this._handlers.push([handlerName, handler]);
    this[handlerName] = handler;
  }

  remove(handlerName: string) {
    if (!handlerName || typeof handlerName !== 'string') throw new Error('Must provide a valid handlerName string');
    if (!this[handlerName]) throw new Error(`Handler ${handlerName} not found`);
    const newHandlers = this._handlers.filter(([existingName, existingHandler]) => {
      if (existingName === handlerName) {
        delete this[handlerName];
        return false;
      }
      return true;
    });
    this._handlers = newHandlers;
  }

  removeAll() {
    for (const [handlerName, _] of this._handlers) this.remove(handlerName);
  }


  addListener(mapEventClass: Event, eventType: string, options?: Object) {
    const listener = (e: Event) => {
      this._map.fire(new mapEventClass(eventType, this._map, e));
      this.processInputEvent(e);
    };
    DOM.addEventListener(this._el, eventType, listener, options);
  }

  addTouchListener(eventType: string, options?: Object) {
    this.addListener(MapTouchEvent, eventType, options);
  }

  addMouseListener(eventType: string, options?: Object) {
    this.addListener(MapMouseEvent, eventType, options);
  }


  processInputEvent(e: MouseEvent | TouchEvent | KeyboardEvent | WheelEvent) {
    let newTransform = {};
    let mapMethods = {};

    for (const [name, handler] of this._handlers) {
      if (!handler.isEnabled()) continue;
      let data = handler.processInputEvent(e);
      if (!data) continue;
      if (data.transform) extend(newTransform, data.transform);
    }
    const tr = this._map.transform;
    let { zoom, bearing, pitch, setLocationAtPoint } = newTransform;
    if (zoom) tr.zoom = zoom;
    if (bearing) tr.bearing = bearing;
    if (pitch) tr.pitch = pitch;
    if (setLocationAtPoint) {
      let [loc, pt] = setLocationAtPoint;
      tr.setLocationAtPoint(loc, pt);
    }

  }
}

export default HandlerManager;
