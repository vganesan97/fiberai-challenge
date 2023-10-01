import { NextApiRequest, NextApiResponse } from 'next';
import { isDomainAvailable } from '@/lib/resources';

export default async (req: NextApiRequest, res: NextApiResponse) => {
    const { domain } = req.query;

    try {
        const available = await isDomainAvailable(domain as string);
        res.status(200).json({ available });
    } catch (error) {
        console.error(`Error checking domain availability: ${error}`);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
