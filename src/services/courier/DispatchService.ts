import { ICourierAdapter } from '../../interfaces/ICourierAdapter.js';
import { PathaoAdapter } from './PathaoAdapter.js';
import { RedxAdapter } from './RedxAdapter.js';
import { SteadfastAdapter } from './SteadfastAdapter.js';

export class DispatchService {
  /**
   * Instantiates and returns the correct class implementing ICourierAdapter
   */
  static getAdapter(courierType: 'PATHAO' | 'REDX' | 'STEADFAST'): ICourierAdapter {
    switch (courierType) {
      case 'PATHAO':
        return new PathaoAdapter();
      case 'REDX':
        return new RedxAdapter();
      case 'STEADFAST':
        return new SteadfastAdapter();
      default:
        throw new Error(`Unsupported courier type: ${courierType}`);
    }
  }
}
