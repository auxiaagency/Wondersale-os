export interface PincodeServiceResult {
  pincode: string;
  isDeliverable: boolean;
  city: string;
  state: string;
  isExpressAvailable: boolean;
  estimatedDays: string;
  isCodAllowed: boolean;
  codLimitPaise: number;
}

export async function checkPincodeServiceability(pincode: string): Promise<PincodeServiceResult> {
  const sanitized = pincode.trim();
  if (!/^\d{6}$/.test(sanitized)) {
    return {
      pincode: sanitized,
      isDeliverable: false,
      city: "Unknown",
      state: "Unknown",
      isExpressAvailable: false,
      estimatedDays: "N/A",
      isCodAllowed: false,
      codLimitPaise: 0,
    };
  }

  // Fast path: instant verification for Bhopal pincodes (462001 - 462050)
  if (sanitized.startsWith("462")) {
    return {
      pincode: sanitized,
      isDeliverable: true,
      city: "Bhopal",
      state: "Madhya Pradesh",
      isExpressAvailable: true,
      estimatedDays: "Today (2-Hour Express)",
      isCodAllowed: true,
      codLimitPaise: 500000,
    };
  }

  // Indian postal zones 1 to 8
  const firstDigit = sanitized.charAt(0);
  const isValidIndianZone = ["1", "2", "3", "4", "5", "6", "7", "8"].includes(firstDigit);

  if (!isValidIndianZone || sanitized === "000000" || sanitized === "999999") {
    return {
      pincode: sanitized,
      isDeliverable: false,
      city: "Unserviceable",
      state: "Unserviceable",
      isExpressAvailable: false,
      estimatedDays: "Not serviceable",
      isCodAllowed: false,
      codLimitPaise: 0,
    };
  }

  // Standard pan-India serviceable delivery
  return {
    pincode: sanitized,
    isDeliverable: true,
    city: "Rest of India",
    state: "India",
    isExpressAvailable: false,
    estimatedDays: "3-5 business days",
    isCodAllowed: true,
    codLimitPaise: 500000,
  };
}
