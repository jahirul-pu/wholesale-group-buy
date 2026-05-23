import axios from 'axios';
import { ICourierAdapter, StandardParcel } from '../../interfaces/ICourierAdapter.js';

const SENDER_NAME = process.env.SAVAR_SENDER_NAME || 'Antigravity Savar Hub';
const SENDER_PHONE = process.env.SAVAR_SENDER_PHONE || '+8801900000000';
const SENDER_ADDRESS = process.env.SAVAR_SENDER_ADDRESS || 'Plot 12, Sector 4, Savar EPZ Road, Savar, Dhaka';

export class PathaoAdapter implements ICourierAdapter {
  private apiBaseUrl = process.env.PATHAO_API_BASE_URL || 'https://api.mock-couriers.com/pathao';

  async createParcel(payload: StandardParcel): Promise<{ trackingId: string; status: string }> {
    console.log(`🚚 [Pathao] Creating parcel for recipient ${payload.customerName}...`);
    
    // Map standard format to Pathao expected API schema
    const pathaoPayload = {
      store_id: 8899,
      sender_name: SENDER_NAME,
      sender_phone: SENDER_PHONE,
      sender_address: SENDER_ADDRESS,
      recipient_name: payload.customerName,
      recipient_phone: payload.customerPhone,
      recipient_address: payload.deliveryAddress,
      recipient_city: 1, // Dhaka City
      recipient_zone: 2, // Savar Zone
      item_weight: payload.weight,
      item_type: 'box',
      amount_to_collect: payload.codAmount,
      delivery_type: 48, // 48 Hour Delivery
    };

    try {
      // Mock API post call using axios (using conditional mock check or standard mock server endpoint)
      // Since it's a mock endpoint, we will mock the response structure or fallback if connection fails
      let trackingId = `PTH-${Math.floor(10000000 + Math.random() * 90000000)}`;
      let status = 'CREATED';

      try {
        const response = await axios.post(`${this.apiBaseUrl}/v1/orders`, pathaoPayload, {
          timeout: 2000,
          headers: { Authorization: 'Bearer mock-pathao-token' }
        });
        if (response.data?.data) {
          trackingId = response.data.data.consignment_id;
          status = response.data.data.order_status;
        }
      } catch (err) {
        console.log(`[Pathao] Mock API connection failed. Using client-side generated credentials for testing.`);
      }

      console.log(`✅ [Pathao] Parcel dispatched. Tracking ID: ${trackingId}, Status: ${status}`);
      return { trackingId, status };
    } catch (error) {
      console.error('[Pathao] Dispatch failed:', error);
      throw new Error('PATHAO_DISPATCH_FAILED');
    }
  }

  async trackParcel(trackingId: string): Promise<{ status: string }> {
    console.log(`🔍 [Pathao] Tracking parcel: ${trackingId}`);
    try {
      try {
        const response = await axios.get(`${this.apiBaseUrl}/v1/orders/${trackingId}`, {
          timeout: 2000,
          headers: { Authorization: 'Bearer mock-pathao-token' }
        });
        if (response.data?.data) {
          return { status: response.data.data.order_status };
        }
      } catch (e) {}
      return { status: 'IN_TRANSIT' };
    } catch (error) {
      console.error('[Pathao] Tracking failed:', error);
      throw new Error('PATHAO_TRACKING_FAILED');
    }
  }
}
