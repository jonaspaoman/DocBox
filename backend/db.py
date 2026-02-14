"""Database client stub — will be replaced by Person B's real implementation."""

import os

_client = None


def get_db():
    """Return a Supabase client. Uses real client if env vars are set, otherwise raises."""
    global _client
    if _client is None:
        from supabase import create_client

        _client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_KEY"],
        )
    return _client
