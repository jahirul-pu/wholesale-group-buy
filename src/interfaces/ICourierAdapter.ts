export interface StandardParcel {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  codAmount: number;
  weight: number; // in kilograms (kg)
}

export interface ICourierAdapter {
  /**
   * Dispatches a parcel order to the concrete courier API.
   * Returns the trackingId and courier status.
   */
  createParcel(payload: StandardParcel): Promise<{ trackingId: string; status: string }>;

  /**
   * Tracks a parcel by its tracking ID.
   * Returns current courier status.
   */
  trackParcel(trackingId: string): Promise<{ status: string }>;
}
