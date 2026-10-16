/**
 * Postcode Lookup Service
 * Handles integration with UK Postcode APIs (e.g., Loqate, GetAddress, Postcodes.io)
 */

export interface AddressResult {
  addressLine1: string;
  city: string;
  postcode: string;
}

export async function lookupPostcode(postcode: string): Promise<AddressResult[]> {
  // In a production environment, this would call a service like Loqate or GetAddress.
  // Example: fetch(`https://api.loqate.com/v1/lookup?postcode=${postcode}&apiKey=${KEY}`)
  
  console.log(`Looking up UK postcode: ${postcode}`);

  // Mocking a professional API response for demonstration purposes
  // In real use, replace this with a fetch call to your chosen provider.
  await new Promise(resolve => setTimeout(resolve, 600)); // Simulate network lag

  // Mock data for common UK test postcodes
  const mockDb: Record<string, AddressResult[]> = {
    'SW1A 1AA': [{ addressLine1: 'Buckingham Palace', city: 'London', postcode: 'SW1A 1AA' }],
    'EC1A 1BB': [{ addressLine1: '123 City Road', city: 'London', postcode: 'EC1A 1BB' }],
    'M1 1AE': [{ addressLine1: '45 Piccadilly', city: 'Manchester', postcode: 'M1 1AE' }],
    'B1 1BB': [{ addressLine1: 'The Bullring', city: 'Birmingham', postcode: 'B1 1BB' }],
  };

  const normalized = postcode.toUpperCase().replace(/\s+/g, ' ');
  const results = mockDb[normalized] || [
    { addressLine1: 'Unknown Address', city: 'Unknown', postcode: normalized }
  ];

  return results;
}
