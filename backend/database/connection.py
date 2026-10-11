from supabase import create_client, Client
from backend.config import SUPABASE_URL, SUPABASE_KEY

# Initialize Supabase client instance
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_supabase_client() -> Client:
    """Returns the initialized Supabase client instance."""
    return supabase
