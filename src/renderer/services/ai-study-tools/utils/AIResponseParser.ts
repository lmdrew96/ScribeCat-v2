/**
 * AIResponseParser
 *
 * Utilities for parsing JSON responses from AI
 */

export class AIResponseParser {
  /**
   * Extract and parse JSON array from AI response
   * @param responseData - The raw response from AI
   * @param contextName - Name for logging purposes (e.g., 'Flashcards', 'Quiz')
   * @param validator - Function to validate the parsed array structure
   * @returns Parsed and validated JSON array
   */
  static parseJsonArray<T>(
    responseData: unknown,
    contextName: string,
    validator: (data: unknown[]) => data is T[]
  ): T[] {
    // Extract response text
    let responseText: string;
    if (typeof responseData === 'string') {
      responseText = responseData;
    } else if (responseData && typeof responseData === 'object' && 'message' in responseData) {
      responseText = (responseData as { message: string }).message;
    } else {
      responseText = JSON.stringify(responseData);
    }

    console.log(`🔍 ${contextName} - Raw AI response:`, responseText.substring(0, 200));

    // Try to find JSON in code blocks first
    let jsonText = '';
    const codeBlockMatch = responseText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
      console.log('📦 Found JSON in code block');
    } else {
      // Try to find raw JSON array
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
        console.log('📄 Found raw JSON array');
      }
    }

    if (!jsonText) {
      throw new Error('No JSON array found in response');
    }

    // Try parsing with two strategies
    try {
      // Try parsing as-is first
      console.log('🔧 Attempting to parse:', jsonText.substring(0, 100));
      const parsed = JSON.parse(jsonText);

      // Validate the structure
      if (validator(parsed)) {
        return parsed;
      } else {
        throw new Error(`Invalid ${contextName.toLowerCase()} structure`);
      }
    } catch (firstParseError) {
      // If first parse fails, try unescaping the string
      console.log('⚠️ First parse failed, trying to unescape...');
      const unescaped = jsonText.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
      const parsed = JSON.parse(unescaped);

      // Validate the structure
      if (validator(parsed)) {
        return parsed;
      } else {
        throw new Error(`Invalid ${contextName.toLowerCase()} structure`);
      }
    }
  }

  /**
   * Parse AI JSON object response (for non-array responses)
   */
  static parseJsonObject<T>(
    responseData: unknown,
    contextName: string,
    validator: (data: unknown) => data is T
  ): T {
    // Extract response text
    let responseText: string;
    if (typeof responseData === 'string') {
      responseText = responseData;
    } else if (responseData && typeof responseData === 'object' && 'message' in responseData) {
      responseText = (responseData as { message: string }).message;
    } else {
      responseText = JSON.stringify(responseData);
    }

    console.log(`🔍 ${contextName} - Raw AI response:`, responseText.substring(0, 200));

    // Try to find JSON in code blocks first (for objects)
    let jsonText = '';
    const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
      console.log('📦 Found JSON object in code block');
    } else {
      // Try to find raw JSON object
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
        console.log('📄 Found raw JSON object');
      }
    }

    if (!jsonText) {
      throw new Error('No JSON object found in response');
    }

    // Try parsing with two strategies
    try {
      // Try parsing as-is first
      console.log('🔧 Attempting to parse:', jsonText.substring(0, 100));
      const parsed = JSON.parse(jsonText);

      // Validate the structure
      if (validator(parsed)) {
        return parsed;
      } else {
        throw new Error(`Invalid ${contextName.toLowerCase()} structure`);
      }
    } catch (firstParseError) {
      // If first parse fails, try unescaping the string
      console.log('⚠️ First parse failed, trying to unescape...');
      const unescaped = jsonText.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\'/g, "'");
      const parsed = JSON.parse(unescaped);

      // Validate the structure
      if (validator(parsed)) {
        return parsed;
      } else {
        throw new Error(`Invalid ${contextName.toLowerCase()} structure`);
      }
    }
  }
}
