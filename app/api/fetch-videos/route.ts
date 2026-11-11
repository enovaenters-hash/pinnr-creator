import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Simple address extraction from description
function extractAddress(description: string): string | null {
  const addressPatterns = [
    /@\s*([^@\n]+)/g, // @location
    /(?:at|visited|location:?|found at)\s+([^\n,]+)/gi,
    /\b([0-9]{1,5}\s+[A-Z][a-z]+\s+[A-Z][a-z]+|[A-Z][a-z]+,\s+[A-Z]{2})\b/,
  ];

  for (const pattern of addressPatterns) {
    const match = description.match(pattern);
    if (match) {
      return match[0].replace(/^@\s*/, '').trim();
    }
  }

  return null;
}

interface TikTokUser {
  id: string;
  uniqueId: string;
  nickname: string;
  avatar: string;
}

interface TikTokVideoItem {
  id: string;
  desc: string;
  createTime: number;
  video: {
    downloadAddr: string;
    playAddr: string;
    cover: string;
  };
}

interface TikTokResponse {
  itemList?: TikTokVideoItem[];
  statusCode?: number;
  data?: {
    itemList?: TikTokVideoItem[];
  };
}

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json();

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // Mock data for MVP - replace with real TikTok API later
    // For now, return sample videos that can be edited manually
    const mockVideos = [
      {
        id: '1',
        videoId: 'video1',
        description: '@Times Square, NYC - Best pizza ever!',
        title: 'Pizza at Times Square',
        thumbnail: 'https://via.placeholder.com/150',
        publishedAt: new Date().toISOString(),
        address: 'Times Square, NYC'
      },
      {
        id: '2',
        videoId: 'video2',
        description: 'Amazing tacos @ Little Mexico, LA',
        title: 'Taco Tuesday',
        thumbnail: 'https://via.placeholder.com/150',
        publishedAt: new Date().toISOString(),
        address: 'Little Mexico, LA'
      },
      {
        id: '3',
        videoId: 'video3',
        description: 'found at Chinatown, SF - dim sum heaven',
        title: 'Dim Sum Adventure',
        thumbnail: 'https://via.placeholder.com/150',
        publishedAt: new Date().toISOString(),
        address: 'Chinatown, SF'
      }
    ];

    return NextResponse.json({
      success: true,
      videos: mockVideos,
      count: mockVideos.length,
      message: `Mock data for ${username} (real TikTok API integration coming soon)`
    });

  } catch (error) {
    console.error('Error fetching videos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch videos' },
      { status: 500 }
    );
  }
}
