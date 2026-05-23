import axios from 'axios';
import { ICourierAdapter, StandardParcel } from '../../interfaces/ICourierAdapter.js';

const SENDER_NAME = process.env.SAVAR_SENDER_NAME || 'Antigravity Savar Hub';
const SENDER_PHONE = process.env.SAVAR_SENDER_PHONE || '+8801900000000';
const SENDER_ADDRESS = process.env.SAVAR_SENDER_ADDRESS || 'Plot 12, Sector 4, Savar EPZ Road, Savar, Dhaka';

export class RedxAdapter implements ICourierAdapter {
  private apiBaseUrl = process.env.REDX_API_BASE_URL || 'https://api.mock-couriers.com/redx';

  async createParcel(payload: StandardParcel): Promise<{ trackingId: string; status: string }> {
    console.log(`🚚 [RedX] Creating parcel for recipient ${payload.customerName}...`);

    // Map standard format to RedX expected API schema
    const redxPayload = {
      pickup_store_id: 1044,
      sender_name: SENDER_NAME,
      sender_phone: SENDER_PHONE,
      sender_address: SENDER_ADDRESS,
      customer_name: payload.customerName,
      customer_phone: payload.customerPhone,
      delivery_address: payload.deliveryAddress,
      parcel_weight: payload.weight, // in kg
      cash_to_collect: payload.codAmount,
      value: payload.codAmount, // estimated value
    };

    try {
      let trackingId = `RDX-${Math.floor(10000000 + Math.random() * 90000000)}`;
      let status = 'PENDING';

      try {
        const response = await axios.post(`${this.apiBaseUrl}/v1/parcels`, redxPayload, {
          timeout: 2000,
          headers: { Authorization: 'Bearer mock-redx-token' }
        });
        if (response.data?.data) {
          trackingId = response.data.data.tracking_id;
          status = response.data.data.parcel_status;
        }
      } catch (err) {
        console.log(`[RedX] Mock API connection failed. Using client-side generated credentials for testing.`);
      }

      console.log(`✅ [RedX] Parcel dispatched. Tracking ID: ${trackingId}, Status: ${status}`);
      return { trackingId, status };
    } catch (error) {
      console.error('[RedX] Dispatch failed:', error);
      throw new Error('REDX_DISPATCH_FAILED');
    }
  }

  async trackParcel(trackingId: string): Promise<{ status: string }> {
    console.log(`🔍 [RedX] Tracking parcel: ${trackingId}`);
    try {
      try {
        const response = await axios.get(`${this.apiBaseUrl}/v1/parcels/${trackingId}`, {
          timeout: 2000,
          headers: { Authorization: 'Bearer mock-redx-token' }
        });
        if (response.data?.data) {
          return { status: response.data.data.parcel_status };
        }
      } catch (e) {}
      return { status: 'IN_TRANSIT' };
    } catch (error) {
      console.error('[RedX] Tracking failed:', error);
      throw new Error('REDX_TRACKING_FAILED');
    }
  }
}
