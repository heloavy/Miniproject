import { TwitterApi } from 'twitter-api-v2';

export interface TweetReaction {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  createdAt: Date;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  sentimentScore?: number;
}

export class TwitterScraper {
  private client: TwitterApi;

  constructor(bearerToken: string) {
    this.client = new TwitterApi(bearerToken);
  }

  async searchTweets(query: string, options: {
    maxResults?: number;
    startTime?: Date;
    endTime?: Date;
    nextToken?: string;
  } = {}): Promise<{
    tweets: TweetReaction[];
    nextToken?: string;
  }> {
    try {
      const { data, meta } = await this.client.v2.search(query, {
        max_results: options.maxResults || 10,
        'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
        'user.fields': ['name', 'username'],
        start_time: options.startTime?.toISOString(),
        end_time: options.endTime?.toISOString(),
        pagination_token: options.nextToken,
        expansions: ['author_id'],
      });

      // Get user data from includes
      const users = new Map(
        data.includes?.users?.map(user => [user.id, user]) || []
      );

      // Map tweets to our format
      const tweets: TweetReaction[] = data.data.map((tweet: any) => {
        const user = users.get(tweet.author_id);
        return {
          id: tweet.id,
          text: tweet.text,
          authorId: tweet.author_id,
          authorName: user?.name || 'Unknown',
          authorUsername: user?.username || 'unknown',
          createdAt: new Date(tweet.created_at),
          likeCount: tweet.public_metrics?.like_count || 0,
          retweetCount: tweet.public_metrics?.retweet_count || 0,
          replyCount: tweet.public_metrics?.reply_count || 0,
        };
      });

      return {
        tweets,
        nextToken: meta?.next_token,
      };
    } catch (error) {
      console.error('Error fetching tweets:', error);
      return { tweets: [] };
    }
  }

  async getReactionsForNews(newsUrl: string, options: {
    maxResults?: number;
    since?: Date;
  } = {}): Promise<TweetReaction[]> {
    // Search for tweets containing the news URL
    const query = `url:"${newsUrl}" -is:retweet`;
    const allTweets: TweetReaction[] = [];
    let nextToken: string | undefined;
    
    do {
      const { tweets, nextToken: newNextToken } = await this.searchTweets(query, {
        maxResults: Math.min(100, options.maxResults || 100),
        startTime: options.since,
        nextToken,
      });
      
      allTweets.push(...tweets);
      nextToken = newNextToken;
      
      if (options.maxResults && allTweets.length >= options.maxResults) {
        break;
      }
    } while (nextToken);

    return allTweets.slice(0, options.maxResults);
  }

  async getUserReaction(tweetId: string): Promise<TweetReaction | null> {
    try {
      const { data: tweet } = await this.client.v2.singleTweet(tweetId, {
        'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
        'user.fields': ['name', 'username'],
        expansions: ['author_id'],
      });

      if (!tweet) return null;

      return {
        id: tweet.id,
        text: tweet.text,
        authorId: tweet.author_id,
        authorName: tweet.author_id, // Will be replaced after we fetch user
        authorUsername: tweet.author_id, // Will be replaced after we fetch user
        createdAt: new Date(tweet.created_at as string),
        likeCount: (tweet as any).public_metrics?.like_count || 0,
        retweetCount: (tweet as any).public_metrics?.retweet_count || 0,
        replyCount: (tweet as any).public_metrics?.reply_count || 0,
      };
    } catch (error) {
      console.error('Error fetching tweet:', error);
      return null;
    }
  }
}
