import { generateToken } from "./auth.js";
import type { AppManagerConfig } from "../types.js";

const BASE_URL = "https://api.appstoreconnect.apple.com/v1";

interface AppData {
  id: string;
  attributes: {
    name: string;
    bundleId: string;
  };
}

interface IAPData {
  id: string;
  attributes: {
    name: string;
    productId: string;
    inAppPurchaseType: string;
  };
}

interface SubscriptionGroupData {
  id: string;
  attributes: {
    referenceName: string;
  };
}

interface SubscriptionData {
  id: string;
  attributes: {
    name: string;
    productId: string;
  };
}

interface ApiResponse<T> {
  data: T[];
  links?: {
    next?: string;
  };
}

/**
 * Makes a request to the App Store Connect API with pagination support.
 */
async function fetchAllPages<T>(
  config: AppManagerConfig,
  initialUrl: string
): Promise<T[]> {
  const token = await generateToken(config);
  const allData: T[] = [];
  let url: string | undefined = initialUrl;
  
  while (url) {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error (${response.status}): ${errorText}`);
    }
    
    const json: ApiResponse<T> = await response.json();
    allData.push(...json.data);
    
    url = json.links?.next;
  }
  
  return allData;
}

/**
 * Fetches all apps from App Store Connect.
 */
async function fetchAllApps(
  config: AppManagerConfig
): Promise<Map<string, string>> {
  const apps = await fetchAllPages<AppData>(
    config,
    `${BASE_URL}/apps?fields[apps]=name,bundleId&limit=200`
  );
  
  // Map: App ID -> App Name
  const appMap = new Map<string, string>();
  for (const app of apps) {
    appMap.set(app.id, app.attributes.name);
  }
  
  return appMap;
}

/**
 * Fetches all IAPs (non-subscription) for a specific app.
 */
async function fetchIAPsForApp(
  config: AppManagerConfig,
  appId: string
): Promise<IAPData[]> {
  try {
    const iaps = await fetchAllPages<IAPData>(
      config,
      `${BASE_URL}/apps/${appId}/inAppPurchasesV2?fields[inAppPurchases]=name,productId,inAppPurchaseType&limit=200`
    );
    return iaps;
  } catch {
    return [];
  }
}

/**
 * Fetches all subscription groups for a specific app.
 */
async function fetchSubscriptionGroupsForApp(
  config: AppManagerConfig,
  appId: string
): Promise<SubscriptionGroupData[]> {
  try {
    const groups = await fetchAllPages<SubscriptionGroupData>(
      config,
      `${BASE_URL}/apps/${appId}/subscriptionGroups?fields[subscriptionGroups]=referenceName&limit=200`
    );
    return groups;
  } catch {
    return [];
  }
}

/**
 * Fetches all subscriptions for a specific subscription group.
 */
async function fetchSubscriptionsForGroup(
  config: AppManagerConfig,
  groupId: string
): Promise<SubscriptionData[]> {
  try {
    const subscriptions = await fetchAllPages<SubscriptionData>(
      config,
      `${BASE_URL}/subscriptionGroups/${groupId}/subscriptions?fields[subscriptions]=name,productId&limit=200`
    );
    return subscriptions;
  } catch {
    return [];
  }
}

/**
 * Product info containing the parent app relationship.
 */
export interface ProductInfo {
  productId: string;      // The vendor identifier / SKU
  productName: string;    // The IAP name
  parentAppId: string;    // The App Store app ID
  parentAppName: string;  // The app name
  isIAP: boolean;
}

/**
 * Builds a complete mapping of all products (apps, IAPs, and subscriptions) to their parent apps.
 * Returns a Map where the key is the product ID (vendor identifier) and the value is ProductInfo.
 */
export async function buildProductMapping(
  config: AppManagerConfig
): Promise<Map<string, ProductInfo>> {
  const productMap = new Map<string, ProductInfo>();
  
  // First, fetch all apps
  console.log("  Fetching apps...");
  const apps = await fetchAllApps(config);
  console.log(`  Found ${apps.size} apps.`);
  
  // Add apps themselves to the mapping
  for (const [appId, appName] of apps) {
    productMap.set(appId, {
      productId: appId,
      productName: appName,
      parentAppId: appId,
      parentAppName: appName,
      isIAP: false,
    });
  }
  
  // Fetch IAPs and subscriptions for each app
  console.log("  Fetching in-app purchases and subscriptions...");
  let iapCount = 0;
  let subscriptionCount = 0;
  
  for (const [appId, appName] of apps) {
    // Fetch regular IAPs (non-subscription)
    const iaps = await fetchIAPsForApp(config, appId);
    
    for (const iap of iaps) {
      // Map by product ID (vendor identifier)
      productMap.set(iap.attributes.productId, {
        productId: iap.attributes.productId,
        productName: iap.attributes.name,
        parentAppId: appId,
        parentAppName: appName,
        isIAP: true,
      });
      
      // Also map by the IAP's App Store Connect ID
      productMap.set(iap.id, {
        productId: iap.attributes.productId,
        productName: iap.attributes.name,
        parentAppId: appId,
        parentAppName: appName,
        isIAP: true,
      });
      
      iapCount++;
    }
    
    // Fetch subscription groups, then subscriptions within each group
    const subscriptionGroups = await fetchSubscriptionGroupsForApp(config, appId);
    
    for (const group of subscriptionGroups) {
      const subscriptions = await fetchSubscriptionsForGroup(config, group.id);
      
      for (const sub of subscriptions) {
        // Map by product ID (vendor identifier)
        productMap.set(sub.attributes.productId, {
          productId: sub.attributes.productId,
          productName: sub.attributes.name,
          parentAppId: appId,
          parentAppName: appName,
          isIAP: true,
        });
        
        // Also map by the subscription's App Store Connect ID
        productMap.set(sub.id, {
          productId: sub.attributes.productId,
          productName: sub.attributes.name,
          parentAppId: appId,
          parentAppName: appName,
          isIAP: true,
        });
        
        subscriptionCount++;
      }
    }
  }
  
  console.log(`  Found ${iapCount} in-app purchases and ${subscriptionCount} subscriptions.`);
  return productMap;
}
