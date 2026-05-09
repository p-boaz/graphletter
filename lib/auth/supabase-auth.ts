import { createClient, type Session } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase client with auth
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: true,
	},
});

// Auth helper functions
export const auth = {
	// Sign up with email and password
	signUp: async (
		email: string,
		password: string,
		metadata?: Record<string, unknown>,
	) => {
		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: {
				data: metadata,
			},
		});
		return { data, error };
	},

	// Sign in with email and password
	signIn: async (email: string, password: string) => {
		const { data, error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});
		return { data, error };
	},

	// Sign in with OAuth provider
	signInWithProvider: async (provider: "google" | "github") => {
		const { data, error } = await supabase.auth.signInWithOAuth({
			provider,
			options: {
				redirectTo: `${window.location.origin}/auth/callback`,
			},
		});
		return { data, error };
	},

	// Sign out
	signOut: async () => {
		const { error } = await supabase.auth.signOut();
		return { error };
	},

	// Get current user
	getCurrentUser: async () => {
		const {
			data: { user },
			error,
		} = await supabase.auth.getUser();
		return { user, error };
	},

	// Get current session
	getSession: async () => {
		const {
			data: { session },
			error,
		} = await supabase.auth.getSession();
		return { session, error };
	},

	// Listen to auth changes
	onAuthStateChange: (
		callback: (event: string, session: Session | null) => void,
	) => {
		return supabase.auth.onAuthStateChange(callback);
	},

	// Reset password
	resetPassword: async (email: string) => {
		const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${window.location.origin}/auth/reset-password`,
		});
		return { data, error };
	},

	// Update password
	updatePassword: async (password: string) => {
		const { data, error } = await supabase.auth.updateUser({
			password,
		});
		return { data, error };
	},
};
