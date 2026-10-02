export const ideateThumbnailPrompt = (
  description: string,
  highlights: string[],
  targetAudience: string,
  channelStyle: string,
  primaryThumbnailGoal: string,
  additionalInstructions: string,
) => `
ROLE: [Thumbnail Editor, Asset Replacement Specialist, and Visual Modifier]

INSTRUCTIONS:
You are tasked with directly editing a reference YouTube thumbnail by replacing specific visual elements with user-provided assets. Your goal is to maintain the original thumbnail's design structure while customizing it with new content. Your output will include:

- A component breakdown of the reference thumbnail
- A mapping plan for asset replacement
- Detailed editing instructions for the modified thumbnail

Please follow this process step-by-step, focusing on precise asset replacement while preserving the reference thumbnail's composition and impact.

START BY:

1. VIDEO CONTENT ANALYSIS:

Carefully analyze the video information provided to understand what the thumbnail needs to communicate:

Video Description:  
${description}

Script Highlights:  
${highlights.join("\n")}

Target Audience:  
${targetAudience}

Channel Style:  
${channelStyle}

Primary Thumbnail Goal:  
${primaryThumbnailGoal}

Additional Instructions:
${additionalInstructions}

2. CONTENT-DRIVEN REPLACEMENT PLANNING:

Based on your video content analysis, identify:
- Which elements of the reference thumbnail need modification to match the new content
- How replacement assets should be modified to convey the new video's message
- What text changes are needed to communicate the new hook
- Any additional visual elements required to represent the new content accurately

REFERENCE THUMBNAIL COMPONENT ANALYSIS:

Break down the reference thumbnail (template.jpg or template.png) into distinct editable components:
- Background element(s): [Identify specific background components]
- Subject(s): [Identify main person/people/objects]
- Text elements: [Identify each separate text element]
- Graphic overlays: [Identify icons, arrows, highlights, etc.]
- Screen captures: [Identify any embedded screenshots]
- Branding elements: [Identify logos, channel identifiers]

For each component, note:
- Precise position within the thumbnail
- Size and scale relative to overall composition
- Visual treatment (colors, effects, styling)
- Z-order (layering)
- Role in the thumbnail's visual hierarchy
- How it contributes to the original thumbnail's message/impact

TEXT LIMITATIONS:

When replacing text elements:
- You may replace the existing text with new content relevant to the video
- You must not add more text elements than what is present in the reference thumbnail
- Ideally, maintain the same amount of text as the reference to preserve visual balance
- It's acceptable to use less text than the reference if it makes sense for the new content
- Match the original font style, size, color, and effects unless specified otherwise

ASSET MAPPING PLAN:

Review the provided assets and create a direct mapping to replace reference components:
- Source Component → Replacement Asset
- [Reference subject] → [User-provided subject photo]
- [Reference text] → [New text content]
- [Reference background] → [New background]
- [Reference graphic] → [New graphic]

For each replacement decision, explain:
- Why this particular asset was selected for this component
- How the replacement will better convey the new video's message
- What modifications are needed to maintain the thumbnail's visual impact

SUBJECT REPLACEMENT SPECIFICATIONS:

When replacing human subjects in the thumbnail:
- Match the positioning and scale of the original subject
- If appropriate, modify the facial expression of the replacement subject to match the emotional tone needed for the new content
- Consider changing or adding clothing/accessories on the replacement subject to better match the reference style or new content requirements
- Apply similar lighting effects, cropping, or treatments to maintain consistency
- Ensure the replacement subject's pose and orientation serve the same visual purpose
- Adjust the subject to properly convey the emotional tone identified in your video content analysis

MODIFICATION SPECIFICATIONS:

For each component replacement, detail:
- Exact positioning to match reference layout
- Size adjustments needed for new asset
- Color corrections/treatments to apply
- Cropping or masking requirements
- Blending techniques for seamless integration
- Content-specific modifications to better represent the new video topic

HANDLING REMOVED ELEMENTS:

When removing any element from the reference thumbnail:
- Do not leave empty gaps or vacant spaces in the design
- Either replace the removed element with another appropriate asset
- Or adjust the layout to eliminate the empty space entirely
- Ensure the final composition remains cohesive and visually balanced
- Adjust surrounding elements as needed to maintain proper visual flow

ADDITIONAL EDITING OPTIONS:

Specify any of these additional modifications:
- Elements to remove completely
- New elements to add (not present in reference)
- Elements to preserve from the original
- Adjustments to overall color grading/treatment
- Changes to emphasize the new content's unique aspects

ASSET USAGE EVALUATION:

After analyzing the reference thumbnail and user assets, provide:

Available Assets:
- [List all provided assets with short descriptions]

Asset Replacement Plan:
- [Component 1] → Replace with [Asset A]
- [Component 2] → Replace with [Asset B]
- [Component 3] → Replace with [New text: "xyz"]
- etc.

Required Asset Modifications:
- [Asset A] – [specific modification details for proper replacement]
- [Asset B] – [cropping/resizing/color correction needed]
- etc.

Missing Assets Needed:
- [Identify any components needing replacement for which no suitable asset was provided]
- [Suggest alternatives or creation methods]

THUMBNAIL EDITING INSTRUCTIONS:

Provide detailed step-by-step editing instructions:
1. Start with the reference thumbnail as the base layer
2. [Component-specific editing instructions]
   - Remove/mask [specific element]
   - Place [new asset] at coordinates matching [reference element]
   - Apply [specific effects] to match reference styling
   - Adjust [colors/contrast/etc.] for visual consistency
3. [Text replacement instructions]
   - Replace [reference text] with [new text]
   - Match font, size, color, and effects
4. [Background modification instructions]
5. [Final adjustments and blending instructions]

OUTPUT FORMAT:

Your final response must include the following sections:

Video Content Analysis
[Summary of key video content elements and how they should be represented in the thumbnail]

Reference Thumbnail Analysis
[Breakdown of original thumbnail components with positions and visual importance]

Content-Driven Replacement Strategy
[How the new video's content guides specific replacement decisions]

Asset Replacement Plan
[Specific mapping of user assets to reference components]

Component Modifications
Background: [Original] → [Replacement with specific editing instructions]
Main Subject: [Original] → [Replacement with specific editing instructions]
Text Elements: [Original] → [Replacement with specific editing instructions]
Graphic Elements: [Original] → [Replacement with specific editing instructions]
Additional Elements: [New elements to add or elements to remove]

Asset Evaluation
Available Assets:
• [filename] – [short description]
• ...

Asset Usage Plan:
• [asset] → [specific component to replace]
• ...

Required Asset Modifications:
• [asset] – [specific modification details]
• ...

Missing Elements:
• [component] – [suggested solution]
• ...

Editing Instructions
[Detailed step-by-step editing process]
• Start with reference thumbnail
• Component 1: [specific replacement instructions]
• Component 2: [specific replacement instructions]
• ...
• Final adjustments: [color correction, blending instructions, etc.]

Remember to maintain the reference thumbnail's composition, impact, and visual hierarchy while replacing specific components with user assets. Your goal is to create a customized version that preserves the original's proven design structure while accurately representing the new video content.

Please follow the process step-by-step as outlined above and provide your final response using the structure described in the OUTPUT FORMAT section. Begin your analysis immediately with the video content, reference thumbnail, and available asset
`;
