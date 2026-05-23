import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  console.log('🔍 Fetching seeded campaign from database...');
  const campaign = await prisma.campaign.findFirst({
    where: { title: 'Premium Mechanical Keyboard - Group Buy' }
  });

  if (!campaign) {
    console.error('❌ Seeded campaign not found. Please seed the database first.');
    process.exit(1);
  }

  const campaignId = campaign.id;
  console.log(`✅ Campaign ID resolved: ${campaignId}`);

  // Wait 3 seconds for the Next.js dev server to be fully online and compile routes
  console.log('⏳ Waiting 3 seconds for Next.js dev server to warm up...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log(`🚀 Performing GET request to http://127.0.0.1:3001/campaigns/${campaignId}`);
  try {
    const response = await fetch(`http://127.0.0.1:3001/campaigns/${campaignId}`, {
      headers: {
        'Accept': 'text/html',
      }
    });

    console.log(`📥 Response Status: ${response.status} (Expected: 200)`);
    const html = await response.text();

    console.log('\n📊 Validating SSR SEO Open Graph Meta Tags in HTML output...');
    
    // Check for OG Title
    const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
                         html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/i);
    if (ogTitleMatch) {
      console.log(`   ✅ og:title exists: "${ogTitleMatch[1]}"`);
    } else {
      console.error('   ❌ og:title NOT found in SSR HTML output!');
    }

    // Check for OG Description
    const ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i) ||
                        html.match(/<meta\s+content="([^"]+)"\s+property="og:description"/i);
    if (ogDescMatch) {
      console.log(`   ✅ og:description exists: "${ogDescMatch[1]}"`);
    } else {
      console.error('   ❌ og:description NOT found in SSR HTML output!');
    }

    // Check for title tag
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      console.log(`   ✅ <title> tag exists: "${titleMatch[1]}"`);
    } else {
      console.error('   ❌ <title> tag NOT found!');
    }

    // Verify main components are present in the response
    const hasPledgeStateMachine = html.includes('Zero-Friction Pledge') || html.includes('PledgeStateMachine') || html.includes('Join Deal');
    const hasLiveCampaignHero = html.includes('Live Group Buy') || html.includes('LiveCampaignHero');
    const hasCascadingPriceCurve = html.includes('Cascading Price Drops') || html.includes('CascadingPriceCurve');

    console.log('\n📊 Validating component containers presence in server response...');
    console.log(`   - LiveCampaignHero container: ${hasLiveCampaignHero ? '✅ Present' : '⚠️ Client-only hydrated'}`);
    console.log(`   - CascadingPriceCurve container: ${hasCascadingPriceCurve ? '✅ Present' : '⚠️ Client-only hydrated'}`);
    console.log(`   - PledgeStateMachine container: ${hasPledgeStateMachine ? '✅ Present' : '⚠️ Client-only hydrated'}`);

  } catch (err: any) {
    console.error('❌ Request to Next.js dev server failed:', err.message);
  }
}

test()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
