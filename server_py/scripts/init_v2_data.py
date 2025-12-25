import sys
import os
import json
import uuid
import time
from dotenv import load_dotenv

# Ensure we can import from the parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mysql_config import SessionLocal, init_database
from pixel_models import BusinessPromptStyleTemplate
from pixel_aigc_server import submit_to_aliyun, check_aliyun_status, upload_url_to_oss, create_qwen_edit_task
from utils.key_manager import key_manager

def init_v2_templates():
    print("Starting V2 Template Initialization & Cleanup...")
    try:
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        load_dotenv(os.path.join(root, '.env.local'))
        load_dotenv(os.path.join(root, '.env'))
    except Exception:
        pass
    
    # Init DB Schema
    init_database()
    
    db = SessionLocal()
    try:
        # 1. CLEANUP: Delete all existing templates to remove duplicates
        print("Cleaning up existing templates...")
        db.query(BusinessPromptStyleTemplate).delete()
        db.commit()
        
        # 2. DEFINE NEW DATA
        # New Templates needing generation
        # Prompt logic: Describe the STYLE and SCENE that Qwen3-VL should aim for.
        new_templates = [
            {
                'name': '查梗图生成',
                'description': '一键生成热门表情包，趣味十足，网络热梗风格',
                # Style Description for VL
                'prompt': 'A viral internet meme style image. High contrast, bold text overlay style, humorous and exaggerated expression. The background should be simple or relevant to the meme context. Visual style: Funny, Internet Culture, Sticker Art.',
                'preview_image_url': 'https://images.unsplash.com/photo-1531259683007-016a7b628fc3?q=80&w=500', 
                'category': 'new_arrival',
                'tags': ['meme', 'funny', 'viral'],
                'user_input_config': {
                    'image_count': 1,
                    'text_inputs': [
                        {'key': 'topic', 'label': '梗主题', 'placeholder': '例如：加班、相亲、减肥', 'required': True},
                        {
                            'key': 'meme_text', 
                            'label': '梗文案', 
                            'placeholder': 'AI生成或手动输入...', 
                            'required': True,
                            'ai_suggestion': {
                                'enabled': True,
                                'source_key': 'topic',
                                'button_text': 'AI写梗',
                                'prompt_template': '请根据用户输入的关键词：“{input}”，生成一句10字以内的搞笑梗图配文，风格要幽默、犀利或网络流行。直接输出文案，不要解释。'
                            }
                        }
                    ]
                }
            },
            {
                'name': '毒舌生图',
                'description': '犀利毒舌点评，生成讽刺漫画风格，夸张变形',
                # Style Description for VL
                'prompt': 'A satirical caricature style illustration. Exaggerated features, black and white ink lines, hand-drawn texture. The mood is sarcastic and sharp. Visual style: Political Cartoon, Caricature, Sketch.',
                'preview_image_url': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=500', 
                'category': 'new_arrival',
                'tags': ['roast', 'caricature', 'sarcasm'],
                'user_input_config': {
                    'image_count': 1,
                    'text_inputs': [
                        {'key': 'topic', 'label': '吐槽对象', 'placeholder': '例如：老板画饼、乙方改稿', 'required': True},
                        {
                            'key': 'roast_point', 
                            'label': '毒舌文案', 
                            'placeholder': 'AI生成或手动输入...', 
                            'required': True,
                            'ai_suggestion': {
                                'enabled': True,
                                'source_key': 'topic',
                                'button_text': 'AI毒舌',
                                'prompt_template': '请根据用户输入的关键词：“{input}”，生成一句毒舌点评，风格要讽刺、夸张、一针见血，15字以内。直接输出文案，不要解释。'
                            }
                        }
                    ]
                }
            }
        ]

        # Selected High Quality Existing Templates (Chinese Config)
        existing_templates = [
            {
                'name': '超写实人像',
                'description': '摄影级人像，柔光与浅景深，真实皮肤质感',
                'prompt': 'Ultra-realistic portrait photography style. Soft professional studio lighting, shallow depth of field (bokeh), 85mm lens look. High detail skin texture, sharp eyes. Visual style: Cinematic, Magazine Cover, 4K.',
                'preview_image_url': 'https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?q=80&w=500',
                'category': '2025_trend',
                'tags': ['portrait', 'photography', 'real'],
                'user_input_config': {
                    'image_count': 1,
                    'text_inputs': [{'key': 'mood', 'label': '情绪', 'placeholder': '如：温暖、冷峻', 'required': False}]
                }
            },
            {
                'name': '国潮工笔画',
                'description': '新国风工笔插画，山海经元素，宣纸质感',
                'prompt': 'Chinese Guochao Gongbi illustration style. Fine line work, traditional Chinese patterns, Shan Hai Jing mythical elements. Rice paper texture background, elegant and muted color palette. Visual style: Neo-Traditional Chinese Art.',
                'preview_image_url': 'https://images.unsplash.com/photo-1515595967223-f9fa59af5a3b?q=80&w=500', 
                'category': '2025_trend',
                'tags': ['guochao', 'illustration', 'ink'],
                'user_input_config': {'image_count': 1}
            },
            {
                'name': '赛博朋克夜景',
                'description': '霓虹雨夜，体积光与镜面反射，科幻城市',
                'prompt': 'Cyberpunk city night scene. Neon lights, rain-slicked streets, volumetric lighting, futuristic architecture. High contrast between neon pinks/blues and dark shadows. Visual style: Sci-Fi, Blade Runner aesthetic.',
                'preview_image_url': 'https://images.unsplash.com/photo-1535385793343-27dff1413c5a?q=80&w=500',
                'category': '2025_trend',
                'tags': ['cyberpunk', 'city', 'neon'],
                'user_input_config': {'image_count': 1}
            },
            {
                'name': '二次元融合风',
                'description': '二次元与写实融合，日式构图，高精细面部',
                'prompt': 'Semi-realistic Anime Fusion style (2.5D). Japanese animation composition, glowing lighting effects. Detailed face with anime proportions but realistic textures. Luminous hair, vibrant background. Visual style: Game Art, Digital Illustration.',
                'preview_image_url': 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=500',
                'category': '2025_trend',
                'tags': ['anime', 'hybrid', 'stylized'],
                'user_input_config': {'image_count': 1}
            },
            {
                'name': '3D盲盒公仔',
                'description': '3D黏土材质，软光与高饱和卡通比例',
                'prompt': '3D Clay Render style (Blind Box Toy). Cute proportions (chibi), soft diffuse lighting, high saturation colors. Plasticine or matte plastic texture. Clean studio background. Visual style: Pop Mart, 3D Character Design.',
                'preview_image_url': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=500',
                'category': '2025_trend',
                'tags': ['3d', 'toy', 'cute'],
                'user_input_config': {'image_count': 1}
            },
            {
                'name': '极简品牌海报',
                'description': '极简品牌视觉，几何构成与负空间',
                'prompt': 'Minimalist Brand Poster design. Geometric composition, generous negative space, modern sans-serif typography. Black and white or monochrome color scheme. Premium, high-end look. Visual style: Swiss Design, Bauhaus.',
                'preview_image_url': 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=500',
                'category': '2025_trend',
                'tags': ['brand', 'minimal', 'poster'],
                'user_input_config': {
                    'image_count': 1,
                    'text_inputs': [
                        {'key': 'brand', 'label': '品牌名', 'placeholder': '如：CandyAI', 'required': False},
                        {'key': 'slogan', 'label': '标语', 'placeholder': '如：创意·智能·美学', 'required': False}
                    ]
                }
            },
            {
                'name': '金马送福',
                'description': '2026马年吉祥，金色剪纸风格，寓意马到成功',
                'prompt': 'Chinese New Year 2026 (Year of the Horse) theme. Golden paper-cut art style. Galloping horse motif, auspicious clouds, red background. Festive and traditional atmosphere. Visual style: Chinese Traditional Art, Paper Cut.',
                'preview_image_url': 'https://images.unsplash.com/photo-1551893478-d726eaf0442c?q=80&w=500',
                'category': '2026_cny',
                'tags': ['CNY', 'Horse', 'Traditional'],
                'user_input_config': {
                    'image_count': 1,
                    'text_inputs': [{'key': 'blessing', 'label': '祝福语', 'placeholder': '例如：马到成功', 'required': False}]
                }
            },
            {
                'name': '新春合家欢',
                'description': 'AI换脸模版，生成全家福背景',
                'prompt': 'Chinese New Year Family Portrait background. Cozy warm coloring, festive decorations (lanterns, knots). Empty space for a family group. Warm indoor lighting, realistic photography style. Visual style: Holiday Greeting Card.',
                'preview_image_url': 'https://images.unsplash.com/photo-1613415260013-439200aef8f8?q=80&w=500',
                'category': '2026_cny',
                'tags': ['Family', 'Photo', 'Warm'],
                'user_input_config': {
                    'image_count': 1,
                    'text_inputs': [{'key': 'family_name', 'label': '家庭姓氏', 'placeholder': '例如：李府', 'required': False}]
                }
            }
        ]
        
        all_templates = new_templates + existing_templates
        
        # 3. INSERT TEMPLATES
        key = key_manager.get_next_key()
        host = os.getenv('OSS_PUBLIC_HOST', '')
        
        for tpl_data in all_templates:
            # Create Template Record
            tpl = BusinessPromptStyleTemplate(
                template_code=f"TPL_{uuid.uuid4().hex[:8].upper()}",
                name=tpl_data['name'],
                description=tpl_data['description'],
                cover_image=tpl_data.get('preview_image_url') or '',
                example_images=[tpl_data.get('preview_image_url')] if tpl_data.get('preview_image_url') else [],
                category=tpl_data['category'],
                tags=tpl_data.get('tags'),
                workflow_id='qwen-turbo', # Default
                default_prompt=tpl_data['prompt'],
                user_input_config=tpl_data['user_input_config'],
                points_cost=2,
                status='active'
            )
            db.add(tpl)
            db.flush() # Get ID
            print(f"Inserted Template: {tpl.name}")

            # 4. GENERATE ASSETS FOR NEW TEMPLATES
            # If it's one of our new templates, we want to generate a REAL result using QwenEdit
            # to show as the cover (Effect Image)
            if tpl_data in new_templates:
                print(f"Generating assets for new template: {tpl.name}...")
                input_img = tpl_data['preview_image_url']
                
                try:
                    # Generate Effect Image (Result)
                    task_id = create_qwen_edit_task(key, tpl.default_prompt, [input_img])
                    if task_id:
                        print(f"  Task Submitted: {task_id}")
                        # Poll for result
                        success = False
                        for _ in range(30): # Wait up to 60s
                            status, results, _ = check_aliyun_status(key, task_id)
                            if status == 'SUCCEEDED' and results:
                                result_url = results[0]
                                # Upload to OSS to persist
                                final_url = upload_url_to_oss(result_url)
                                
                                # Set Cover = Result (Effect Image)
                                tpl.cover_image = final_url
                                # Set Examples = [Input, Result]
                                tpl.example_images = [input_img, final_url]
                                success = True
                                print(f"  Assets Generated! Cover: {final_url}")
                                break
                            elif status == 'FAILED':
                                print("  Generation Failed.")
                                break
                            time.sleep(2)
                        
                        if not success:
                            print("  Timeout waiting for generation.")
                except Exception as e:
                    print(f"  Asset Generation Error: {e}")

        db.commit()
        print("V2 Data Cleanup & Initialization Completed.")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == '__main__':
    init_v2_templates()
