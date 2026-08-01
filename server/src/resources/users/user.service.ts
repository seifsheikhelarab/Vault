import { like, or } from 'drizzle-orm';
import { db } from '../../lib/db';
import { user } from '../../lib/db/auth-schema';

export class UserService {
    async search(query: string) {
        if (!query || query.length < 2) return [];

        const pattern = `${query.toLowerCase()}%`;

        const results = await db
            .select({
                id: user.id,
                name: user.name,
                email: user.email
            })
            .from(user)
            .where(
                or(
                    like(user.email, pattern),
                    like(user.name, pattern)
                )
            )
            .limit(8);

        return results;
    }
}
