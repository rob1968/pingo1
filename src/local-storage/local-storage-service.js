class LocalStorageService {

	static saveToken(token) {
		window.localStorage['mean-token'] = token;
	}

	static saveBalance(balance) {
		window.localStorage['balance'] = balance;
	}

	static getBalance() {
		if (window.localStorage['balance'] !== undefined)
			return window.localStorage['balance'];
	}

	static getToken() {
		if (window.localStorage['mean-token'] !== undefined)
			return window.localStorage['mean-token'];
	}

	static getAdminToken() {
		if (window.localStorage['admin-token'] !== undefined)
			return window.localStorage['admin-token'];
	}

	static logout() {
		window.localStorage.removeItem('mean-token');
		window.localStorage.removeItem('bingo-user-profile'); // Also remove user profile
		window.localStorage.removeItem('balance'); // Also remove separate balance if stored
	}

	static isLoggedIn() {
		let token = LocalStorageService.getToken();

		if (!token) {
			return false;
		}

		let payload;
		try {
			payload = token.split('.')[1];
			if (!payload) {
				return false;
			}
			payload = window.atob(payload);
			payload = JSON.parse(payload);
			return payload.exp > Date.now() / 1000;
		} catch (e) {
			// console.error('LocalStorageService.isLoggedIn: Error decoding token:', e); // Optional: Keep for rare issues
			// console.error('LocalStorageService.isLoggedIn: Failing token string:', token); // Optional: Keep for rare issues
			return false;
		}
	}

	static currentUser() {
		if (LocalStorageService.isLoggedIn()) { // Still good to check if a valid session token exists
			const profileString = window.localStorage['bingo-user-profile'];
			if (profileString) {
				try {
					const profile = JSON.parse(profileString);
					// Ensure essential fields are present, adjust as needed
					return {
						name: profile.name,
						piUid: profile.piUid, // Added piUid
						balance: profile.balance,
						wins: profile.wins,
						// email might not be directly in this object if not sent from /api/pi-login
						// If email is needed and not in profile, it would have to come from JWT or another source
					};
				} catch (e) {
					console.error('LocalStorageService.currentUser: Error parsing user profile from localStorage:', e);
					return null; // Or handle error appropriately
				}
			}
			// Fallback or error if 'bingo-user-profile' is not set but user is "logged in" by token
			// This indicates a potential inconsistency, but for now, we prioritize the profile object.
			// console.warn('LocalStorageService.currentUser: Token exists but user profile string not found in localStorage.');
			return null;
		}
		return null; // Not logged in
	}
}

export default LocalStorageService;

