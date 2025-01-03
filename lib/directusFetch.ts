interface DirectusAuthResponseData {
  access_token: string;
  refresh_token: string;
  expires: number;
  refresh_token_expires: number;
}

interface DirectusAuthResponse {
  data: DirectusAuthResponseData;
}

export async function directusFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  // Retrieve tokens from localStorage
  const accessToken = localStorage.getItem("publications.access_token");
  const refreshToken = localStorage.getItem("publications.refresh_token");
  // Ensure headers is an object
  const headers: HeadersInit = options.headers ? options.headers : {};
  // Attach current access token if available
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  // Perform the initial request
  let response = await fetch(url, { ...options, headers });
  // Check if we need to refresh token
  if (response.status === 401 && refreshToken) {
    // Attempt to refresh the token
    const refreshRes = await fetch("https://admin.urikabioworks.com/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (refreshRes.ok) {
      // Parse the JSON for new token data
      const refreshData: DirectusAuthResponse = await refreshRes.json();
      const newAccess = refreshData.data.access_token;
      const newRefresh = refreshData.data.refresh_token;
      // Update localStorage
      localStorage.setItem("publications.access_token", newAccess);
      localStorage.setItem("publications.refresh_token", newRefresh);
      // Retry original request with the new access token
      headers["Authorization"] = `Bearer ${newAccess}`;
      response = await fetch(url, { ...options, headers });
    }
  }
  return response;
}
